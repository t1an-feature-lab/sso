"use server";

import { createHash, randomBytes, randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { QueryTypes, UniqueConstraintError, type Transaction } from "sequelize";
import type { ActionState, PublicUser } from "@/common/types";
import { createSession, deleteSession, getCurrentSessionHash, requireUser } from "./auth";
import { db } from "./db";
import { hashPassword, verifyPassword } from "./password";
import { ensureStore } from "./store";
import { readLogo } from "./logo";

const value = (formData: FormData, name: string) => {
  const entry = formData.get(name);
  return typeof entry === "string" ? entry.trim() : "";
};
const uuid = /^[a-f\d]{8}-(?:[a-f\d]{4}-){3}[a-f\d]{12}$/i;

export async function loginAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const account = value(formData, "account");
  const passwordEntry = formData.get("password");
  const password = typeof passwordEntry === "string" ? passwordEntry : "";
  const fieldErrors: Record<string, string> = {};
  if (account !== "admin" && !/^1[3-9]\d{9}$/.test(account)) fieldErrors.account = "请输入正确的手机号";
  if (!password || password.length > 128) fieldErrors.password = "请输入 1–128 位密码";
  if (Object.keys(fieldErrors).length) return { error: "请检查输入内容", fieldErrors };

  let user: { id: string; role: PublicUser["role"]; passwordHash: string };
  try {
    await ensureStore();
    const [attempt] = await db.query<{ failures: number }>(`
      INSERT INTO sso_login_attempts (account, failures) VALUES (:account, 1)
      ON CONFLICT (account) DO UPDATE SET
        failures = CASE WHEN sso_login_attempts.window_started_at < NOW() - INTERVAL '15 minutes'
          THEN 1 ELSE sso_login_attempts.failures + 1 END,
        window_started_at = CASE WHEN sso_login_attempts.window_started_at < NOW() - INTERVAL '15 minutes'
          THEN NOW() ELSE sso_login_attempts.window_started_at END
      RETURNING failures
    `, { replacements: { account }, type: QueryTypes.SELECT });
    if (attempt.failures > 8) return { error: "尝试次数过多，请在 15 分钟后重试" };

    const findUser = () => db.query<typeof user>(`
      SELECT id, role, password_hash AS "passwordHash" FROM sso_users WHERE login_account = :account
    `, { replacements: { account }, type: QueryTypes.SELECT });
    let [existing] = await findUser();
    if (!existing) {
      if (password.length < 6) {
        return { error: "请检查输入内容", fieldErrors: { password: "新账户密码至少为 6 位" } };
      }
      const id = randomUUID();
      const passwordHash = await hashPassword(password);
      await db.query(`
        INSERT INTO sso_users (id, login_account, username, phone, password_hash, role)
        VALUES (:id, :account, :account, :account, :passwordHash, 'user')
        ON CONFLICT DO NOTHING
      `, { replacements: { id, account, passwordHash } });
      [existing] = await findUser();
      if (!existing) {
        await db.query(`
          INSERT INTO sso_users (id, login_account, username, phone, password_hash, role)
          VALUES (:id, :account, :username, :account, :passwordHash, 'user')
          ON CONFLICT (login_account) DO NOTHING
        `, { replacements: { id, account, username: `${account}-${id}`, passwordHash } });
        [existing] = await findUser();
      }
    }
    if (!existing || !(await verifyPassword(password, existing.passwordHash))) {
      return { error: "账号或密码错误", fieldErrors: { password: "账号或密码错误" } };
    }
    user = existing;
    await db.query("DELETE FROM sso_login_attempts WHERE account = :account", { replacements: { account } });
    await createSession(user.id);
  } catch (error) {
    console.error("SSO login failed", error instanceof Error ? error.name : "UnknownError");
    return { error: "暂时无法登录，请检查数据库连接后重试" };
  }

  const requested = value(formData, "next");
  let destination = user.role === "admin" ? "/admin" : "/";
  try {
    const target = new URL(requested, "https://sso.local");
    if (requested.startsWith("/") && !requested.startsWith("//") && target.origin === "https://sso.local" && target.pathname !== "/login") {
      destination = `${target.pathname}${target.search}`;
    }
  } catch { /* Use the role's default destination for malformed return URLs. */ }
  if (destination.startsWith("/admin") && user.role !== "admin") destination = "/";
  redirect(destination);
}

export async function logoutAction() {
  await deleteSession();
  redirect("/login");
}

export async function updateProfileAction(formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const username = value(formData, "username");
  const fieldErrors: Record<string, string> = {};
  if (!username || username.length > 64 || /\p{Cc}/u.test(username)) {
    fieldErrors.username = "请输入 1–64 个字符的用户名，不能包含控制字符";
  }
  try {
    const avatar = await readLogo(formData, "avatar");
    if (avatar && "error" in avatar) fieldErrors.avatar = avatar.error;
    if (Object.keys(fieldErrors).length) return { fieldErrors };
    const image = avatar && "data" in avatar ? avatar : null;
    const rows = await db.query<{ id: string }>(`
      UPDATE sso_users SET username = :username
        ${image ? ", avatar_data = :data, avatar_mime = :mime, avatar_updated_at = NOW()" : ""}
      WHERE id = :id RETURNING id
    `, { replacements: { id: user.id, username, data: image?.data ?? null, mime: image?.mime ?? null }, type: QueryTypes.SELECT });
    if (!rows.length) return { error: "账户不存在，请重新登录" };
  } catch (error) {
    if (error instanceof UniqueConstraintError) return { fieldErrors: { username: "该用户名已被使用" } };
    console.error("SSO profile update failed", error instanceof Error ? error.name : "UnknownError");
    return { error: "个人信息保存失败，请稍后重试" };
  }
  revalidatePath("/", "layout");
  return { success: "个人信息已保存" };
}

export async function updateUserRoleAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  if (user.role !== "admin") return { error: "无权修改用户权限" };
  const id = value(formData, "id").toLowerCase();
  const role = value(formData, "role");
  if (!uuid.test(id)) return { error: "用户不存在" };
  if (id === user.id.toLowerCase()) return { error: "不能修改自己的权限" };
  if (role !== "admin" && role !== "user") return { error: "请选择有效的用户角色" };

  try {
    const rows = await db.query<{ id: string }>(`
      UPDATE sso_users AS target SET role = :role
      WHERE target.id = :id AND target.id <> :actorId AND target.login_account <> 'admin'
        AND EXISTS (SELECT 1 FROM sso_users AS actor WHERE actor.id = :actorId AND actor.role = 'admin')
      RETURNING target.id
    `, { replacements: { id, role, actorId: user.id }, type: QueryTypes.SELECT });
    if (!rows.length) return { error: "用户不存在或无权修改" };
  } catch (error) {
    console.error("SSO user role update failed", error instanceof Error ? error.name : "UnknownError");
    return { error: "权限修改失败，请稍后重试" };
  }
  revalidatePath("/", "layout");
  return { success: "用户权限已更新", id };
}

async function revokeOtherSessions(id: string, sessionHash: string | null, transaction: Transaction) {
  await db.query(`
    DELETE FROM sso_sessions WHERE user_id = :id
      AND (:sessionHash IS NULL OR token_hash <> :sessionHash)
  `, { replacements: { id, sessionHash }, transaction });
}

export async function resetUserPasswordAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  if (user.role !== "admin") return { error: "无权重置用户密码" };
  const id = value(formData, "id").toLowerCase();
  if (!uuid.test(id)) return { error: "用户不存在" };
  return resetPassword(user, id);
}

export async function resetOwnPasswordAction(): Promise<ActionState> {
  const user = await requireUser();
  return resetPassword(user, user.id);
}

async function resetPassword(user: PublicUser, id: string): Promise<ActionState> {
  try {
    const password = "user12345";
    const passwordHash = await hashPassword(password);
    const sessionHash = await getCurrentSessionHash();
    const updated = await db.transaction(async (transaction) => {
      const rows = await db.query<{ id: string }>(`
        UPDATE sso_users AS target SET password_hash = :passwordHash
        WHERE target.id = :id
          AND (target.id = :actorId OR EXISTS (SELECT 1 FROM sso_users AS actor WHERE actor.id = :actorId AND actor.role = 'admin'))
        RETURNING target.id
      `, { replacements: { id, passwordHash, actorId: user.id }, type: QueryTypes.SELECT, transaction });
      if (!rows.length) return false;
      await revokeOtherSessions(id, sessionHash, transaction);
      return true;
    });
    if (!updated) return { error: "用户不存在或无权修改" };
    revalidatePath("/admin/users");
    return { success: `密码已重置为 ${password}`, id };
  } catch (error) {
    console.error("SSO user password reset failed", error instanceof Error ? error.name : "UnknownError");
    return { error: "密码重置失败，请稍后重试" };
  }
}

export async function changePasswordAction(formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const passwordValue = (name: string) => {
    const entry = formData.get(name);
    return typeof entry === "string" ? entry : "";
  };
  const currentPassword = passwordValue("currentPassword");
  const newPassword = passwordValue("newPassword");
  const confirmPassword = passwordValue("confirmPassword");
  const fieldErrors: Record<string, string> = {};
  if (!currentPassword || currentPassword.length > 128) fieldErrors.currentPassword = "请输入 1–128 位当前密码";
  if (newPassword.length < 6 || newPassword.length > 128) fieldErrors.newPassword = "请输入 6–128 位新密码";
  if (newPassword !== confirmPassword) fieldErrors.confirmPassword = "两次输入的新密码不一致";
  if (Object.keys(fieldErrors).length) return { fieldErrors };

  try {
    const sessionHash = await getCurrentSessionHash();
    const result = await db.transaction(async (transaction): Promise<ActionState> => {
      const [account] = await db.query<{ passwordHash: string }>(`
        SELECT password_hash AS "passwordHash" FROM sso_users WHERE id = :id FOR UPDATE
      `, { replacements: { id: user.id }, type: QueryTypes.SELECT, transaction });
      if (!account) return { error: "账户不存在，请重新登录" };
      if (!(await verifyPassword(currentPassword, account.passwordHash))) {
        return { fieldErrors: { currentPassword: "当前密码不正确" } };
      }
      const passwordHash = await hashPassword(newPassword);
      await db.query("UPDATE sso_users SET password_hash = :passwordHash WHERE id = :id", {
        replacements: { id: user.id, passwordHash }, transaction,
      });
      await revokeOtherSessions(user.id, sessionHash, transaction);
      return { success: "密码已更改" };
    });
    if (result.success) revalidatePath("/", "layout");
    return result;
  } catch (error) {
    console.error("SSO password change failed", error instanceof Error ? error.name : "UnknownError");
    return { error: "密码更改失败，请稍后重试" };
  }
}

export async function deleteUserAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  if (user.role !== "admin") return { error: "无权删除用户" };
  const id = value(formData, "id").toLowerCase();
  if (!uuid.test(id)) return { error: "用户不存在" };
  if (id === user.id.toLowerCase()) return { error: "不能删除当前登录用户" };
  try {
    const rows = await db.query<{ id: string }>(`
      DELETE FROM sso_users AS target
      WHERE target.id = :id AND target.id <> :actorId AND target.login_account <> 'admin'
        AND EXISTS (SELECT 1 FROM sso_users AS actor WHERE actor.id = :actorId AND actor.role = 'admin')
      RETURNING target.id
    `, { replacements: { id, actorId: user.id }, type: QueryTypes.SELECT });
    if (!rows.length) return { error: "用户不存在或无权删除" };
  } catch (error) {
    console.error("SSO user deletion failed", error instanceof Error ? error.name : "UnknownError");
    return { error: "用户删除失败，请稍后重试" };
  }
  revalidatePath("/", "layout");
  return { success: "用户已删除", id };
}

async function validateApplication(formData: FormData) {
  const name = value(formData, "name");
  const protocol = value(formData, "protocol");
  const homepage = value(formData, "homepage");
  const status = value(formData, "status") || "active";
  const redirectUri = value(formData, "redirectUris");
  const redirectUris = redirectUri ? [redirectUri] : [];
  const scopes = protocol === "oidc" ? ["openid", "profile", "email"] : ["profile"];
  const fieldErrors: Record<string, string> = {};
  if (!name || name.length > 80) fieldErrors.name = "请输入 1–80 个字符的应用名称";
  if (protocol !== "oauth" && protocol !== "oidc") fieldErrors.protocol = "请选择 OAuth 或 OIDC";
  if (status !== "active" && status !== "disabled") fieldErrors.status = "请选择有效的应用状态";
  const validUrl = (uri: string, callback = false) => {
    try {
      const url = new URL(uri);
      const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
      return uri.length <= 2048 && !/\s/.test(uri) && !url.username && !url.password &&
        (url.protocol === "https:" || (url.protocol === "http:" && (!callback || loopback))) &&
        (!callback || !uri.includes("#"));
    } catch { return false; }
  };
  if (!redirectUri || /\s/.test(redirectUri) || !validUrl(redirectUri, true)) {
    fieldErrors.redirectUris = "请输入一个 HTTPS 回调地址；本地回调可使用 HTTP，地址不能包含片段";
  }
  if (!homepage || !validUrl(homepage)) fieldErrors.homepage = "请输入有效的 HTTP 或 HTTPS 首页地址";
  const logo = await readLogo(formData);
  if (logo && "error" in logo) fieldErrors.logo = logo.error;
  return { name, protocol, homepage, status, redirectUris, scopes, fieldErrors, logo: logo && "data" in logo ? logo : null };
}

function refreshApplications() {
  revalidatePath("/", "layout");
  revalidatePath("/admin", "layout");
}

export async function createApplicationAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const id = value(formData, "id");
  if (!uuid.test(id)) return { error: "应用标识无效，请刷新页面后重试" };
  const application = await validateApplication(formData);
  if (Object.keys(application.fieldErrors).length) return { error: "请检查输入内容", fieldErrors: application.fieldErrors };
  try {
    await db.query(`
      INSERT INTO sso_client_applications
        (id, owner_id, protocol, name, client_id, client_secret, redirect_uris, scopes, homepage, status,
          logo_data, logo_mime, logo_updated_at)
      VALUES (:id, :ownerId, :protocol, :name, :clientId, '',
        CAST(:redirectUris AS JSONB), CAST(:scopes AS JSONB), :homepage, :status,
        :logoData, :logoMime, CASE WHEN :logoMime IS NULL THEN NULL ELSE NOW() END)
    `, { replacements: {
      id, ownerId: user.id, protocol: application.protocol, name: application.name,
      clientId: randomBytes(16).toString("hex"),
      redirectUris: JSON.stringify(application.redirectUris), scopes: JSON.stringify(application.scopes),
      homepage: application.homepage, status: application.status,
      logoData: application.logo?.data ?? null, logoMime: application.logo?.mime ?? null,
    } });
  } catch (error) {
    console.error("SSO application creation failed", error instanceof Error ? error.name : "UnknownError");
    return { error: "创建失败，请稍后重试" };
  }
  refreshApplications();
  return { success: "应用已创建", id };
}

export async function updateApplicationAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const id = value(formData, "id");
  if (!uuid.test(id)) return { error: "应用不存在" };
  const application = await validateApplication(formData);
  if (Object.keys(application.fieldErrors).length) return { error: "请检查输入内容", fieldErrors: application.fieldErrors };
  try {
    const rows = await db.query<{ id: string }>(`
      UPDATE sso_client_applications SET name = :name,
        redirect_uris = CAST(:redirectUris AS JSONB),
        homepage = :homepage, status = :status
        ${application.logo ? ", logo_data = :logoData, logo_mime = :logoMime, logo_updated_at = NOW()" : ""}
      WHERE id = :id AND protocol = :protocol ${user.role === "admin" ? "" : "AND owner_id = :ownerId"}
      RETURNING id
    `, { replacements: {
      id, ownerId: user.id, protocol: application.protocol, name: application.name,
      redirectUris: JSON.stringify(application.redirectUris),
      homepage: application.homepage, status: application.status,
      logoData: application.logo?.data ?? null, logoMime: application.logo?.mime ?? null,
    }, type: QueryTypes.SELECT });
    if (!rows.length) return { error: "应用不存在或无权修改" };
  } catch (error) {
    console.error("SSO application update failed", error instanceof Error ? error.name : "UnknownError");
    return { error: "保存失败，请稍后重试" };
  }
  refreshApplications();
  return { success: "配置已保存", id };
}

export async function deleteApplicationAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const id = value(formData, "id");
  if (!uuid.test(id)) return { error: "应用不存在" };
  try {
    const rows = await db.query<{ id: string }>(`
      DELETE FROM sso_client_applications WHERE id = :id
      ${user.role === "admin" ? "" : "AND owner_id = :ownerId"} RETURNING id
    `, { replacements: { id, ownerId: user.id }, type: QueryTypes.SELECT });
    if (!rows.length) return { error: "应用不存在或无权删除" };
  } catch (error) {
    console.error("SSO application deletion failed", error instanceof Error ? error.name : "UnknownError");
    return { error: "删除失败，请稍后重试" };
  }
  refreshApplications();
  return { success: "应用已删除", id };
}

async function lockApplication(id: string, user: PublicUser, transaction: Transaction) {
  const [application] = await db.query<{ id: string }>(`
    SELECT id FROM sso_client_applications WHERE id = :id
    ${user.role === "admin" ? "" : "AND owner_id = :ownerId"} FOR UPDATE
  `, { replacements: { id, ownerId: user.id }, transaction, type: QueryTypes.SELECT });
  return application;
}

export async function generateClientSecretAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const id = value(formData, "id");
  if (!uuid.test(id)) return { error: "应用不存在" };
  const secret = randomBytes(32).toString("base64url");
  try {
    const result = await db.transaction(async (transaction): Promise<ActionState> => {
      if (!(await lockApplication(id, user, transaction))) return { error: "应用不存在或无权管理密钥" };
      await db.query(`
        INSERT INTO sso_client_secrets (id, application_id, secret_hash, last_four, created_by)
        VALUES (:secretId, :id, :secretHash, :lastFour, :createdBy)
      `, { transaction, replacements: {
        secretId: randomUUID(), id, secretHash: createHash("sha256").update(secret).digest("hex"),
        lastFour: secret.slice(-4), createdBy: user.id,
      } });
      return { success: "密钥已生成", id, clientSecret: secret };
    });
    if (result.success) refreshApplications();
    return result;
  } catch (error) {
    console.error("SSO secret generation failed", error instanceof Error ? error.name : "UnknownError");
    return { error: "生成失败，请稍后重试" };
  }
}

export async function deleteClientSecretAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const id = value(formData, "id");
  const secretId = value(formData, "secretId");
  if (!uuid.test(id) || !uuid.test(secretId)) return { error: "密钥不存在" };
  try {
    const result = await db.transaction(async (transaction): Promise<ActionState> => {
      // The application row serializes concurrent generation/deletion before counting secrets.
      if (!(await lockApplication(id, user, transaction))) return { error: "应用不存在或无权管理密钥" };
      const secrets = await db.query<{ id: string }>(
        "SELECT id FROM sso_client_secrets WHERE application_id = :id",
        { replacements: { id }, transaction, type: QueryTypes.SELECT },
      );
      if (!secrets.some((secret) => secret.id === secretId)) return { error: "密钥不存在" };
      if (secrets.length <= 1) return { error: "至少保留一枚密钥，请先生成新密钥" };
      await db.query("DELETE FROM sso_client_secrets WHERE id = :secretId AND application_id = :id", {
        replacements: { id, secretId }, transaction,
      });
      return { success: "密钥已删除", id };
    });
    if (result.success) refreshApplications();
    return result;
  } catch (error) {
    console.error("SSO secret deletion failed", error instanceof Error ? error.name : "UnknownError");
    return { error: "删除失败，请稍后重试" };
  }
}

export async function revokeAllApplicationTokensAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const id = value(formData, "id");
  if (!uuid.test(id)) return { error: "应用不存在" };
  try {
    const result = await db.transaction(async (transaction): Promise<ActionState> => {
      if (!(await lockApplication(id, user, transaction))) return { error: "应用不存在或无权撤销授权" };
      await db.query("DELETE FROM sso_client_authorizations WHERE application_id = :id", {
        replacements: { id }, transaction,
      });
      return { success: "已撤销全部授权和令牌", id };
    });
    if (result.success) refreshApplications();
    return result;
  } catch (error) {
    console.error("SSO authorization revocation failed", error instanceof Error ? error.name : "UnknownError");
    return { error: "撤销失败，请稍后重试" };
  }
}
