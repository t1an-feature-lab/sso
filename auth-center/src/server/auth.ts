import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { PublicUser } from "@/common/types";
import { db } from "./db";

const secure = process.env.NODE_ENV === "production";
const cookieName = secure ? "__Host-sso_session" : "sso_session";
const maxAge = 60 * 60 * 24 * 7;
const cookieOptions = { httpOnly: true, secure, sameSite: "lax" as const, path: "/" };

const tokenHash = (token: string) => createHash("sha256").update(token).digest("hex");

export async function getCurrentSessionHash() {
  const token = (await cookies()).get(cookieName)?.value;
  return token && /^[a-f0-9]{64}$/.test(token) ? tokenHash(token) : null;
}

export async function getCurrentUser(): Promise<PublicUser | null> {
  const sessionHash = await getCurrentSessionHash();
  if (!sessionHash) return null;
  const session = await db.session.findFirst({
    where: { tokenHash: sessionHash, expiresAt: { gt: new Date() } },
    select: { user: { select: {
      id: true, username: true, phone: true, role: true, createdAt: true, avatarUpdatedAt: true,
    } } },
  });
  if (!session) return null;
  const { avatarUpdatedAt, ...account } = session.user;
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
  await db.$transaction(async (transaction) => {
    if (previousToken) {
      await transaction.session.deleteMany({ where: { tokenHash: tokenHash(previousToken) } });
    }
    await transaction.session.deleteMany({ where: { expiresAt: { lte: new Date() } } });
    await transaction.session.create({
      data: { tokenHash: tokenHash(token), userId, expiresAt: new Date(Date.now() + maxAge * 1000) },
    });
  });
  cookieStore.set(cookieName, token, { ...cookieOptions, maxAge });
}

export async function deleteSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(cookieName)?.value;
  if (token) {
    await db.session.deleteMany({ where: { tokenHash: tokenHash(token) } });
  }
  cookieStore.set(cookieName, "", { ...cookieOptions, maxAge: 0 });
}
