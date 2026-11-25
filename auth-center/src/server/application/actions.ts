"use server";

import { createHash, randomBytes, randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { QueryTypes, type Transaction } from "sequelize";
import type { ActionState, PublicUser } from "@/common/types";
import { requireUser } from "../auth";
import { db } from "../db";
import { readLogo } from "../logo";
import { encryptClientSecret } from "../secret-cipher";

const value = (formData: FormData, name: string) => {
  const entry = formData.get(name);
  return typeof entry === "string" ? entry.trim() : "";
};
const uuid = /^[a-f\d]{8}-(?:[a-f\d]{4}-){3}[a-f\d]{12}$/i;

async function validateApplication(formData: FormData) {
  const name = value(formData, "name");
  const homepage = value(formData, "homepage");
  const status = value(formData, "status") || "active";
  const redirectUri = value(formData, "redirectUris");
  const redirectUris = redirectUri ? [redirectUri] : [];
  const scopes = ["openid", "profile", "email"];
  const fieldErrors: Record<string, string> = {};
  if (!name || name.length > 80) fieldErrors.name = "请输入 1–80 个字符的应用名称";
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
  return { name, homepage, status, redirectUris, scopes, fieldErrors, logo: logo && "data" in logo ? logo : null };
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
        (id, owner_id, name, client_id, client_secret, redirect_uris, scopes, homepage, status,
          logo_data, logo_mime, logo_updated_at)
      VALUES (:id, :ownerId, :name, :clientId, '',
        CAST(:redirectUris AS JSONB), CAST(:scopes AS JSONB), :homepage, :status,
        :logoData, :logoMime, CASE WHEN :logoMime IS NULL THEN NULL ELSE NOW() END)
    `, { replacements: {
      id, ownerId: user.id, name: application.name,
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
      WHERE id = :id ${user.role === "admin" ? "" : "AND owner_id = :ownerId"}
      RETURNING id
    `, { replacements: {
      id, ownerId: user.id, name: application.name,
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

export async function setApplicationStatusAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  if (user.role !== "admin") return { error: "无权修改应用状态" };
  const id = value(formData, "id");
  const status = value(formData, "status");
  if (!uuid.test(id)) return { error: "应用不存在" };
  if (status !== "active" && status !== "disabled") return { error: "请选择有效的应用状态" };
  try {
    const rows = await db.query<{ id: string }>(`
      UPDATE sso_client_applications AS target SET status = :status
      WHERE target.id = :id
        AND EXISTS (SELECT 1 FROM sso_users AS actor WHERE actor.id = :actorId AND actor.role = 'admin')
      RETURNING target.id
    `, { replacements: { id, status, actorId: user.id }, type: QueryTypes.SELECT });
    if (!rows.length) return { error: "应用不存在或无权修改" };
  } catch (error) {
    console.error("SSO application status update failed", error instanceof Error ? error.name : "UnknownError");
    return { error: "状态更新失败，请稍后重试" };
  }
  refreshApplications();
  return { success: status === "active" ? "应用已启用" : "应用已停用", id };
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
  const secretId = randomUUID();
  try {
    const result = await db.transaction(async (transaction): Promise<ActionState> => {
      if (!(await lockApplication(id, user, transaction))) return { error: "应用不存在或无权管理密钥" };
      await db.query(`
        INSERT INTO sso_client_secrets (id, application_id, secret_hash, secret_encrypted, last_four, created_by)
        VALUES (:secretId, :id, :secretHash, :secretEncrypted, :lastFour, :createdBy)
      `, { transaction, replacements: {
        secretId, id, secretHash: createHash("sha256").update(secret).digest("hex"),
        secretEncrypted: encryptClientSecret(secret),
        lastFour: secret.slice(-4), createdBy: user.id,
      } });
      return { success: "密钥已生成", id, secretId, clientSecret: secret };
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
