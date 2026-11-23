import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { QueryTypes } from "sequelize";
import type { PublicUser } from "@/common/types";
import { db } from "./db";
import { ensureStore } from "./store";

const secure = process.env.NODE_ENV === "production";
const cookieName = secure ? "__Host-sso_session" : "sso_session";
const maxAge = 60 * 60 * 24 * 7;
const cookieOptions = { httpOnly: true, secure, sameSite: "lax" as const, path: "/" };

const tokenHash = (token: string) => createHash("sha256").update(token).digest("hex");

type UserRow = Omit<PublicUser, "createdAt" | "avatarUrl"> & { createdAt: Date; avatarUpdatedAt: Date | null };

export async function getCurrentSessionHash() {
  const token = (await cookies()).get(cookieName)?.value;
  return token && /^[a-f0-9]{64}$/.test(token) ? tokenHash(token) : null;
}

export async function getCurrentUser(): Promise<PublicUser | null> {
  const sessionHash = await getCurrentSessionHash();
  if (!sessionHash) return null;
  await ensureStore();
  const [user] = await db.query<UserRow>(`
    SELECT u.id, u.username, u.phone, u.role, u.created_at AS "createdAt", u.avatar_updated_at AS "avatarUpdatedAt"
    FROM sso_sessions s JOIN sso_users u ON u.id = s.user_id
    WHERE s.token_hash = :tokenHash AND s.expires_at > NOW()
  `, { replacements: { tokenHash: sessionHash }, type: QueryTypes.SELECT });
  if (!user) return null;
  const { avatarUpdatedAt, ...account } = user;
  return {
    ...account,
    createdAt: account.createdAt.toISOString(),
    avatarUrl: avatarUpdatedAt ? `/api/users/${account.id}/avatar?v=${avatarUpdatedAt.getTime()}` : "",
  };
}

export async function requireUser(next = "/") {
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(next)}`);
  return user;
}

export async function requireAdmin() {
  const user = await requireUser("/admin");
  if (user.role !== "admin") redirect("/");
  return user;
}

export async function createSession(userId: string) {
  const token = randomBytes(32).toString("hex");
  const cookieStore = await cookies();
  const previousToken = cookieStore.get(cookieName)?.value;
  await db.transaction(async (transaction) => {
    if (previousToken) {
      await db.query("DELETE FROM sso_sessions WHERE token_hash = :tokenHash", {
        replacements: { tokenHash: tokenHash(previousToken) }, transaction,
      });
    }
    await db.query("DELETE FROM sso_sessions WHERE expires_at <= NOW()", { transaction });
    await db.query(`
      INSERT INTO sso_sessions (token_hash, user_id, expires_at)
      VALUES (:tokenHash, :userId, :expiresAt)
    `, {
      replacements: { tokenHash: tokenHash(token), userId, expiresAt: new Date(Date.now() + maxAge * 1000) },
      transaction,
    });
  });
  cookieStore.set(cookieName, token, { ...cookieOptions, maxAge });
}

export async function deleteSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(cookieName)?.value;
  if (token) {
    await ensureStore();
    await db.query("DELETE FROM sso_sessions WHERE token_hash = :tokenHash", {
      replacements: { tokenHash: tokenHash(token) },
    });
  }
  cookieStore.set(cookieName, "", { ...cookieOptions, maxAge: 0 });
}
