import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  BUILT_IN_ADMIN_USERNAME,
  DEFAULT_USER_PASSWORD,
  type PublicUser,
  type UserRole,
  type UsersPagePayload,
} from "@/lib/auth/types";
import { ensureStorage, type StoredUser } from "./db";
import { hashPassword, verifyPassword } from "./password";
import { HttpError } from "./repository";

const IS_PROD = process.env.NODE_ENV === "production";
const COOKIE_NAME = IS_PROD ? "__Host-base_session" : "base_session";
const SESSION_MAX_AGE = 60 * 60 * 24 * 7;
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: IS_PROD,
  sameSite: "lax" as const,
  path: "/",
};

interface DbUserRow {
  id: string;
  username: string;
  password_hash: string;
  role: string;
  is_built_in: boolean;
  created_at: Date | string;
  updated_at: Date | string;
}

function toIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : String(value);
}

function toPublicUser(row: DbUserRow | StoredUser): PublicUser {
  if ("password_hash" in row) {
    return {
      id: row.id,
      username: row.username,
      role: row.role === "admin" ? "admin" : "user",
      isBuiltIn: Boolean(row.is_built_in || row.username === BUILT_IN_ADMIN_USERNAME),
      createdAt: toIso(row.created_at),
      updatedAt: toIso(row.updated_at),
    };
  }
  return {
    id: row.id,
    username: row.username,
    role: row.role === "admin" ? "admin" : "user",
    isBuiltIn: Boolean(row.isBuiltIn || row.username === BUILT_IN_ADMIN_USERNAME),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function createId(prefix: string): string {
  return `${prefix}_${randomBytes(8).toString("hex")}`;
}

export async function getCurrentSessionHash(): Promise<string | null> {
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  return token && /^[a-f0-9]{64}$/.test(token) ? hashToken(token) : null;
}

export async function getCurrentUser(): Promise<PublicUser | null> {
  const sessionHash = await getCurrentSessionHash();
  if (!sessionHash) return null;

  const { mode, pool, memoryAuth } = await ensureStorage();
  if (mode === "postgres" && pool) {
    const result = await pool.query<DbUserRow>(
      `SELECT u.id, u.username, u.password_hash, u.role, u.is_built_in, u.created_at, u.updated_at
       FROM bitable_sessions s
       JOIN bitable_users u ON u.id = s.user_id
       WHERE s.token_hash = $1 AND s.expires_at > NOW()
       LIMIT 1`,
      [sessionHash]
    );
    const row = result.rows[0];
    return row ? toPublicUser(row) : null;
  }

  const now = Date.now();
  const session = memoryAuth.sessions.find(
    (s) => s.tokenHash === sessionHash && new Date(s.expiresAt).getTime() > now
  );
  if (!session) return null;
  const user = memoryAuth.users.find((u) => u.id === session.userId);
  return user ? toPublicUser(user) : null;
}

export async function requireUser(next = "/"): Promise<PublicUser> {
  const user = await getCurrentUser();
  if (!user) {
    const query = next && next !== "/" ? `?next=${encodeURIComponent(next)}` : "";
    redirect(`/login${query}`);
  }
  return user;
}

export async function requireAdmin(next = "/permissions/users"): Promise<PublicUser> {
  const user = await requireUser(next);
  if (user.role !== "admin") {
    redirect("/");
  }
  return user;
}

export async function requireApiUser(): Promise<PublicUser> {
  const user = await getCurrentUser();
  if (!user) {
    throw new HttpError(401, "请先登录");
  }
  return user;
}

export async function requireApiAdmin(): Promise<PublicUser> {
  const user = await requireApiUser();
  if (user.role !== "admin") {
    throw new HttpError(403, "仅管理员可访问该功能");
  }
  return user;
}

export async function createSession(userId: string): Promise<void> {
  const token = randomBytes(32).toString("hex");
  const nextHash = hashToken(token);
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE * 1000);
  const cookieStore = await cookies();
  const previousToken = cookieStore.get(COOKIE_NAME)?.value;
  const previousHash =
    previousToken && /^[a-f0-9]{64}$/.test(previousToken)
      ? hashToken(previousToken)
      : null;

  const { mode, pool, memoryAuth } = await ensureStorage();
  if (mode === "postgres" && pool) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      if (previousHash) {
        await client.query("DELETE FROM bitable_sessions WHERE token_hash = $1", [
          previousHash,
        ]);
      }
      await client.query("DELETE FROM bitable_sessions WHERE expires_at <= NOW()");
      await client.query(
        `INSERT INTO bitable_sessions (token_hash, user_id, expires_at)
         VALUES ($1, $2, $3)`,
        [nextHash, userId, expiresAt.toISOString()]
      );
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  } else {
    const now = Date.now();
    memoryAuth.sessions = memoryAuth.sessions.filter(
      (s) =>
        s.tokenHash !== previousHash && new Date(s.expiresAt).getTime() > now
    );
    memoryAuth.sessions.push({
      tokenHash: nextHash,
      userId,
      expiresAt: expiresAt.toISOString(),
      createdAt: new Date(now).toISOString(),
    });
  }

  cookieStore.set(COOKIE_NAME, token, {
    ...COOKIE_OPTIONS,
    maxAge: SESSION_MAX_AGE,
  });
}

export async function deleteSession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  const tokenHash =
    token && /^[a-f0-9]{64}$/.test(token) ? hashToken(token) : null;

  if (tokenHash) {
    const { mode, pool, memoryAuth } = await ensureStorage();
    if (mode === "postgres" && pool) {
      await pool.query("DELETE FROM bitable_sessions WHERE token_hash = $1", [
        tokenHash,
      ]);
    } else {
      memoryAuth.sessions = memoryAuth.sessions.filter(
        (s) => s.tokenHash !== tokenHash
      );
    }
  }

  cookieStore.set(COOKIE_NAME, "", { ...COOKIE_OPTIONS, maxAge: 0 });
}

async function revokeSessions(
  userId: string,
  keepSessionHash?: string | null
): Promise<void> {
  const { mode, pool, memoryAuth } = await ensureStorage();
  if (mode === "postgres" && pool) {
    if (keepSessionHash) {
      await pool.query(
        "DELETE FROM bitable_sessions WHERE user_id = $1 AND token_hash <> $2",
        [userId, keepSessionHash]
      );
    } else {
      await pool.query("DELETE FROM bitable_sessions WHERE user_id = $1", [
        userId,
      ]);
    }
    return;
  }

  memoryAuth.sessions = memoryAuth.sessions.filter(
    (s) =>
      s.userId !== userId ||
      (keepSessionHash ? s.tokenHash === keepSessionHash : false)
  );
}

export async function loginOrRegister(input: {
  username: string;
  password: string;
}): Promise<{ user: PublicUser; registered: boolean }> {
  const username = input.username.trim();
  const password = input.password;

  if (!username) {
    throw new HttpError(400, "请输入用户名");
  }
  if (username.length > 64) {
    throw new HttpError(400, "用户名不能超过 64 个字符");
  }
  if (!password) {
    throw new HttpError(400, "请输入密码");
  }
  if (password.length > 128) {
    throw new HttpError(400, "密码不能超过 128 个字符");
  }

  const { mode, pool, memoryAuth } = await ensureStorage();
  if (mode === "postgres" && pool) {
    const found = await pool.query<DbUserRow>(
      `SELECT id, username, password_hash, role, is_built_in, created_at, updated_at
       FROM bitable_users
       WHERE username = $1
       LIMIT 1`,
      [username]
    );
    const existing = found.rows[0];
    if (existing) {
      const valid = await verifyPassword(password, existing.password_hash);
      if (!valid) {
        throw new HttpError(401, "用户名或密码错误");
      }
      await createSession(existing.id);
      return { user: toPublicUser(existing), registered: false };
    }

    const id = createId("usr");
    const passwordHash = await hashPassword(password);
    try {
      const inserted = await pool.query<DbUserRow>(
        `INSERT INTO bitable_users (id, username, password_hash, role, is_built_in)
         VALUES ($1, $2, $3, 'user', FALSE)
         RETURNING id, username, password_hash, role, is_built_in, created_at, updated_at`,
        [id, username, passwordHash]
      );
      const created = inserted.rows[0];
      await createSession(created.id);
      return { user: toPublicUser(created), registered: true };
    } catch (error) {
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        (error as { code?: string }).code === "23505"
      ) {
        throw new HttpError(409, "该用户名已被注册，请重新登录");
      }
      throw error;
    }
  }

  const existing = memoryAuth.users.find((u) => u.username === username);
  if (existing) {
    const valid = await verifyPassword(password, existing.passwordHash);
    if (!valid) {
      throw new HttpError(401, "用户名或密码错误");
    }
    await createSession(existing.id);
    return { user: toPublicUser(existing), registered: false };
  }

  const now = new Date().toISOString();
  const created: StoredUser = {
    id: createId("usr"),
    username,
    passwordHash: await hashPassword(password),
    role: "user",
    isBuiltIn: false,
    createdAt: now,
    updatedAt: now,
  };
  memoryAuth.users.push(created);
  await createSession(created.id);
  return { user: toPublicUser(created), registered: true };
}

export async function changeOwnPassword(
  userId: string,
  currentSessionHash: string | null,
  input: {
    currentPassword: string;
    newPassword: string;
    confirmPassword: string;
  }
): Promise<void> {
  const { currentPassword, newPassword, confirmPassword } = input;
  if (!currentPassword) {
    throw new HttpError(400, "请输入当前密码");
  }
  if (!newPassword || newPassword.length < 5 || newPassword.length > 128) {
    throw new HttpError(400, "新密码长度需在 5 到 128 个字符之间");
  }
  if (newPassword !== confirmPassword) {
    throw new HttpError(400, "两次输入的新密码不一致");
  }

  const { mode, pool, memoryAuth } = await ensureStorage();
  if (mode === "postgres" && pool) {
    const found = await pool.query<{
      username: string;
      is_built_in: boolean;
      password_hash: string;
    }>(
      "SELECT username, is_built_in, password_hash FROM bitable_users WHERE id = $1 LIMIT 1",
      [userId]
    );
    const row = found.rows[0];
    if (!row) {
      throw new HttpError(404, "用户不存在");
    }
    if (row.is_built_in || row.username === BUILT_IN_ADMIN_USERNAME) {
      throw new HttpError(403, "内置 admin 账号不支持更改密码");
    }
    const valid = await verifyPassword(currentPassword, row.password_hash);
    if (!valid) {
      throw new HttpError(400, "当前密码不正确");
    }
    const nextHash = await hashPassword(newPassword);
    await pool.query(
      "UPDATE bitable_users SET password_hash = $1, updated_at = NOW() WHERE id = $2",
      [nextHash, userId]
    );
    await revokeSessions(userId, currentSessionHash);
    return;
  }

  const user = memoryAuth.users.find((u) => u.id === userId);
  if (!user) {
    throw new HttpError(404, "用户不存在");
  }
  if (user.isBuiltIn || user.username === BUILT_IN_ADMIN_USERNAME) {
    throw new HttpError(403, "内置 admin 账号不支持更改密码");
  }
  const valid = await verifyPassword(currentPassword, user.passwordHash);
  if (!valid) {
    throw new HttpError(400, "当前密码不正确");
  }
  user.passwordHash = await hashPassword(newPassword);
  user.updatedAt = new Date().toISOString();
  await revokeSessions(userId, currentSessionHash);
}

export async function resetOwnPassword(
  userId: string,
  currentSessionHash: string | null
): Promise<void> {
  const { mode, pool, memoryAuth } = await ensureStorage();
  if (mode === "postgres" && pool) {
    const found = await pool.query<{ username: string; is_built_in: boolean }>(
      "SELECT username, is_built_in FROM bitable_users WHERE id = $1 LIMIT 1",
      [userId]
    );
    const row = found.rows[0];
    if (!row) {
      throw new HttpError(404, "用户不存在");
    }
    if (row.is_built_in || row.username === BUILT_IN_ADMIN_USERNAME) {
      throw new HttpError(403, "内置 admin 账号不支持重置密码");
    }
    const nextHash = await hashPassword(DEFAULT_USER_PASSWORD);
    await pool.query(
      "UPDATE bitable_users SET password_hash = $1, updated_at = NOW() WHERE id = $2",
      [nextHash, userId]
    );
    await revokeSessions(userId, currentSessionHash);
    return;
  }

  const user = memoryAuth.users.find((u) => u.id === userId);
  if (!user) {
    throw new HttpError(404, "用户不存在");
  }
  if (user.isBuiltIn || user.username === BUILT_IN_ADMIN_USERNAME) {
    throw new HttpError(403, "内置 admin 账号不支持重置密码");
  }
  user.passwordHash = await hashPassword(DEFAULT_USER_PASSWORD);
  user.updatedAt = new Date().toISOString();
  await revokeSessions(userId, currentSessionHash);
}

export async function listUsersPage(params?: {
  page?: number;
  pageSize?: number;
}): Promise<UsersPagePayload> {
  const pageSize = Math.min(50, Math.max(1, Math.floor(params?.pageSize ?? 10)));
  const requestedPage = Math.max(1, Math.floor(params?.page ?? 1));

  const { mode, pool, memoryAuth } = await ensureStorage();
  if (mode === "postgres" && pool) {
    const countRes = await pool.query<{ count: string }>(
      "SELECT COUNT(*)::text AS count FROM bitable_users"
    );
    const total = Number(countRes.rows[0]?.count ?? 0);
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const page = Math.min(requestedPage, totalPages);
    const offset = (page - 1) * pageSize;

    const rowsRes = await pool.query<DbUserRow>(
      `SELECT id, username, password_hash, role, is_built_in, created_at, updated_at
       FROM bitable_users
       ORDER BY is_built_in DESC, created_at ASC, id ASC
       LIMIT $1 OFFSET $2`,
      [pageSize, offset]
    );

    return {
      users: rowsRes.rows.map(toPublicUser),
      total,
      page,
      pageSize,
      totalPages,
    };
  }

  const sorted = [...memoryAuth.users].sort((a, b) => {
    if (a.isBuiltIn !== b.isBuiltIn) return a.isBuiltIn ? -1 : 1;
    return a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id);
  });
  const total = sorted.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(requestedPage, totalPages);
  const offset = (page - 1) * pageSize;

  return {
    users: sorted.slice(offset, offset + pageSize).map(toPublicUser),
    total,
    page,
    pageSize,
    totalPages,
  };
}

export async function updateUserRole(
  actorId: string,
  targetUserId: string,
  role: UserRole
): Promise<PublicUser> {
  if (role !== "admin" && role !== "user") {
    throw new HttpError(400, "无效的用户角色");
  }

  const { mode, pool, memoryAuth } = await ensureStorage();
  if (mode === "postgres" && pool) {
    const found = await pool.query<DbUserRow>(
      `SELECT id, username, password_hash, role, is_built_in, created_at, updated_at
       FROM bitable_users
       WHERE id = $1
       LIMIT 1`,
      [targetUserId]
    );
    const target = found.rows[0];
    if (!target) {
      throw new HttpError(404, "用户不存在");
    }
    if (target.is_built_in || target.username === BUILT_IN_ADMIN_USERNAME) {
      throw new HttpError(403, "内置 admin 账号角色不可修改");
    }
    if (target.id === actorId) {
      throw new HttpError(403, "不能修改当前登录用户的角色");
    }

    const updated = await pool.query<DbUserRow>(
      `UPDATE bitable_users
       SET role = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING id, username, password_hash, role, is_built_in, created_at, updated_at`,
      [role, targetUserId]
    );
    return toPublicUser(updated.rows[0]);
  }

  const target = memoryAuth.users.find((u) => u.id === targetUserId);
  if (!target) {
    throw new HttpError(404, "用户不存在");
  }
  if (target.isBuiltIn || target.username === BUILT_IN_ADMIN_USERNAME) {
    throw new HttpError(403, "内置 admin 账号角色不可修改");
  }
  if (target.id === actorId) {
    throw new HttpError(403, "不能修改当前登录用户的角色");
  }
  target.role = role;
  target.updatedAt = new Date().toISOString();
  return toPublicUser(target);
}

export async function resetUserPasswordByAdmin(
  actorId: string,
  targetUserId: string,
  currentSessionHash: string | null
): Promise<PublicUser> {
  const nextHash = await hashPassword(DEFAULT_USER_PASSWORD);
  const { mode, pool, memoryAuth } = await ensureStorage();

  if (mode === "postgres" && pool) {
    const found = await pool.query<DbUserRow>(
      `SELECT id, username, password_hash, role, is_built_in, created_at, updated_at
       FROM bitable_users
       WHERE id = $1
       LIMIT 1`,
      [targetUserId]
    );
    const target = found.rows[0];
    if (!target) {
      throw new HttpError(404, "用户不存在");
    }
    if (target.is_built_in || target.username === BUILT_IN_ADMIN_USERNAME) {
      throw new HttpError(403, "内置 admin 账号不支持该操作");
    }

    const updated = await pool.query<DbUserRow>(
      `UPDATE bitable_users
       SET password_hash = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING id, username, password_hash, role, is_built_in, created_at, updated_at`,
      [nextHash, targetUserId]
    );
    await revokeSessions(
      targetUserId,
      targetUserId === actorId ? currentSessionHash : null
    );
    return toPublicUser(updated.rows[0]);
  }

  const target = memoryAuth.users.find((u) => u.id === targetUserId);
  if (!target) {
    throw new HttpError(404, "用户不存在");
  }
  if (target.isBuiltIn || target.username === BUILT_IN_ADMIN_USERNAME) {
    throw new HttpError(403, "内置 admin 账号不支持该操作");
  }
  target.passwordHash = nextHash;
  target.updatedAt = new Date().toISOString();
  await revokeSessions(
    targetUserId,
    targetUserId === actorId ? currentSessionHash : null
  );
  return toPublicUser(target);
}

export async function deleteUserByAdmin(
  actorId: string,
  targetUserId: string
): Promise<void> {
  const { mode, pool, memoryAuth } = await ensureStorage();

  if (mode === "postgres" && pool) {
    const found = await pool.query<DbUserRow>(
      `SELECT id, username, password_hash, role, is_built_in, created_at, updated_at
       FROM bitable_users
       WHERE id = $1
       LIMIT 1`,
      [targetUserId]
    );
    const target = found.rows[0];
    if (!target) {
      throw new HttpError(404, "用户不存在");
    }
    if (target.is_built_in || target.username === BUILT_IN_ADMIN_USERNAME) {
      throw new HttpError(403, "内置 admin 账号不可删除");
    }
    if (target.id === actorId) {
      throw new HttpError(403, "不能删除当前登录用户");
    }
    await pool.query("DELETE FROM bitable_users WHERE id = $1", [targetUserId]);
    return;
  }

  const index = memoryAuth.users.findIndex((u) => u.id === targetUserId);
  if (index === -1) {
    throw new HttpError(404, "用户不存在");
  }
  const target = memoryAuth.users[index];
  if (target.isBuiltIn || target.username === BUILT_IN_ADMIN_USERNAME) {
    throw new HttpError(403, "内置 admin 账号不可删除");
  }
  if (target.id === actorId) {
    throw new HttpError(403, "不能删除当前登录用户");
  }
  memoryAuth.users.splice(index, 1);
  memoryAuth.sessions = memoryAuth.sessions.filter(
    (s) => s.userId !== targetUserId
  );
}
