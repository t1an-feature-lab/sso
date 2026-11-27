import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Prisma } from "@/generated/prisma/client";
import {
  BUILT_IN_ADMIN_USERNAME,
  DEFAULT_USER_PASSWORD,
  type PublicUser,
  type UserRole,
  type UsersPagePayload,
} from "@/lib/types";
import {
  db,
  ensureBuiltInAdmin,
  isDatabaseUnreachable,
  resetDatabaseClient,
} from "./db";
import { HttpError } from "./http";
import { hashPassword, verifyPassword } from "./password";

const IS_PROD = process.env.NODE_ENV === "production";
const COOKIE_NAME = IS_PROD
  ? "__Host-agent_builder_session"
  : "agent_builder_session";
const SESSION_MAX_AGE = 60 * 60 * 24 * 7;
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: IS_PROD,
  sameSite: "lax" as const,
  path: "/",
};

const PUBLIC_USER_SELECT = {
  id: true,
  username: true,
  role: true,
  isBuiltIn: true,
  avatarUpdatedAt: true,
  createdAt: true,
  updatedAt: true,
} as const;

function toPublicUser(user: {
  id: string;
  username: string;
  role: string;
  isBuiltIn: boolean;
  avatarUpdatedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): PublicUser {
  return {
    id: user.id,
    username: user.username,
    role: user.role === "admin" ? "admin" : "user",
    isBuiltIn: Boolean(
      user.isBuiltIn || user.username === BUILT_IN_ADMIN_USERNAME
    ),
    avatarUrl: user.avatarUpdatedAt
      ? `/api/users/${encodeURIComponent(user.id)}/avatar?v=${user.avatarUpdatedAt.getTime()}`
      : null,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function getCurrentSessionHash(): Promise<string | null> {
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  return token && /^[a-f0-9]{64}$/.test(token) ? hashToken(token) : null;
}

async function findCurrentSession(sessionHash: string) {
  return db.authSession.findFirst({
    where: {
      tokenHash: sessionHash,
      expiresAt: { gt: new Date() },
    },
    include: { user: { select: PUBLIC_USER_SELECT } },
  });
}

async function loadCurrentUser(): Promise<PublicUser | null> {
  await ensureBuiltInAdmin();
  const sessionHash = await getCurrentSessionHash();
  if (!sessionHash) return null;
  const session = await findCurrentSession(sessionHash);
  return session?.user ? toPublicUser(session.user) : null;
}

export async function getCurrentUser(): Promise<PublicUser | null> {
  try {
    return await loadCurrentUser();
  } catch (error) {
    if (!isDatabaseUnreachable(error)) throw error;
    resetDatabaseClient();
    return loadCurrentUser();
  }
}

export async function requireUser(next = "/"): Promise<PublicUser> {
  const user = await getCurrentUser();
  if (!user) {
    const query =
      next && next !== "/" ? `?next=${encodeURIComponent(next)}` : "";
    redirect(`/login${query}`);
  }
  return user;
}

export async function requireAdmin(
  next = "/settings/permissions",
  fallbackPath = "/"
): Promise<PublicUser> {
  const user = await requireUser(next);
  if (user.role !== "admin") {
    redirect(fallbackPath);
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

  await db.$transaction(async (tx) => {
    if (previousHash) {
      await tx.authSession.deleteMany({ where: { tokenHash: previousHash } });
    }
    await tx.authSession.deleteMany({
      where: { expiresAt: { lte: new Date() } },
    });
    await tx.authSession.create({
      data: {
        tokenHash: nextHash,
        userId,
        expiresAt,
      },
    });
  });

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
    await db.authSession.deleteMany({ where: { tokenHash } });
  }

  cookieStore.set(COOKIE_NAME, "", { ...COOKIE_OPTIONS, maxAge: 0 });
}

async function revokeSessions(
  userId: string,
  keepSessionHash?: string | null
): Promise<void> {
  await db.authSession.deleteMany({
    where: {
      userId,
      ...(keepSessionHash ? { tokenHash: { not: keepSessionHash } } : {}),
    },
  });
}

export async function loginOrRegister(input: {
  username: string;
  password: string;
}): Promise<{ user: PublicUser; registered: boolean }> {
  await ensureBuiltInAdmin();

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

  const existing = await db.user.findUnique({ where: { username } });
  if (existing) {
    const valid = await verifyPassword(password, existing.passwordHash);
    if (!valid) {
      throw new HttpError(401, "用户名或密码错误");
    }
    await createSession(existing.id);
    return { user: toPublicUser(existing), registered: false };
  }

  const passwordHash = await hashPassword(password);
  try {
    const created = await db.user.create({
      data: {
        username,
        passwordHash,
        role: "user",
        isBuiltIn: false,
      },
    });
    await createSession(created.id);
    return { user: toPublicUser(created), registered: true };
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new HttpError(409, "该用户名已被注册，请重新登录");
    }
    throw error;
  }
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

  const row = await db.user.findUnique({ where: { id: userId } });
  if (!row) {
    throw new HttpError(404, "用户不存在");
  }
  if (row.isBuiltIn || row.username === BUILT_IN_ADMIN_USERNAME) {
    throw new HttpError(403, "内置 admin 账号不支持更改密码");
  }
  const valid = await verifyPassword(currentPassword, row.passwordHash);
  if (!valid) {
    throw new HttpError(400, "当前密码不正确");
  }
  const nextHash = await hashPassword(newPassword);
  await db.user.update({
    where: { id: userId },
    data: { passwordHash: nextHash },
  });
  await revokeSessions(userId, currentSessionHash);
}

export async function resetOwnPassword(
  userId: string,
  currentSessionHash: string | null
): Promise<void> {
  const row = await db.user.findUnique({ where: { id: userId } });
  if (!row) {
    throw new HttpError(404, "用户不存在");
  }
  if (row.isBuiltIn || row.username === BUILT_IN_ADMIN_USERNAME) {
    throw new HttpError(403, "内置 admin 账号不支持重置密码");
  }
  const nextHash = await hashPassword(DEFAULT_USER_PASSWORD);
  await db.user.update({
    where: { id: userId },
    data: { passwordHash: nextHash },
  });
  await revokeSessions(userId, currentSessionHash);
}

export async function listUsersPage(params?: {
  page?: number;
  pageSize?: number;
}): Promise<UsersPagePayload> {
  await ensureBuiltInAdmin();
  const pageSize = Math.min(
    50,
    Math.max(1, Math.floor(params?.pageSize ?? 10))
  );
  const requestedPage = Math.max(1, Math.floor(params?.page ?? 1));

  const total = await db.user.count();
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(requestedPage, totalPages);
  const skip = (page - 1) * pageSize;

  const rows = await db.user.findMany({
    select: PUBLIC_USER_SELECT,
    orderBy: [{ isBuiltIn: "desc" }, { createdAt: "asc" }, { id: "asc" }],
    take: pageSize,
    skip,
  });

  return {
    users: rows.map(toPublicUser),
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

  const target = await db.user.findUnique({ where: { id: targetUserId } });
  if (!target) {
    throw new HttpError(404, "用户不存在");
  }
  if (target.isBuiltIn || target.username === BUILT_IN_ADMIN_USERNAME) {
    throw new HttpError(403, "内置 admin 账号角色不可修改");
  }
  if (target.id === actorId) {
    throw new HttpError(403, "不能修改当前登录用户的角色");
  }

  const updated = await db.user.update({
    where: { id: targetUserId },
    data: { role },
  });
  return toPublicUser(updated);
}

export async function resetUserPasswordByAdmin(
  actorId: string,
  targetUserId: string,
  currentSessionHash: string | null
): Promise<PublicUser> {
  const target = await db.user.findUnique({ where: { id: targetUserId } });
  if (!target) {
    throw new HttpError(404, "用户不存在");
  }
  if (target.isBuiltIn || target.username === BUILT_IN_ADMIN_USERNAME) {
    throw new HttpError(403, "内置 admin 账号不支持该操作");
  }

  const nextHash = await hashPassword(DEFAULT_USER_PASSWORD);
  const updated = await db.user.update({
    where: { id: targetUserId },
    data: { passwordHash: nextHash },
  });
  await revokeSessions(
    targetUserId,
    targetUserId === actorId ? currentSessionHash : null
  );
  return toPublicUser(updated);
}

export async function deleteUserByAdmin(
  actorId: string,
  targetUserId: string
): Promise<void> {
  const target = await db.user.findUnique({ where: { id: targetUserId } });
  if (!target) {
    throw new HttpError(404, "用户不存在");
  }
  if (target.isBuiltIn || target.username === BUILT_IN_ADMIN_USERNAME) {
    throw new HttpError(403, "内置 admin 账号不可删除");
  }
  if (target.id === actorId) {
    throw new HttpError(403, "不能删除当前登录用户");
  }
  await db.user.delete({ where: { id: targetUserId } });
}
