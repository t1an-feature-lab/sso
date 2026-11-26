import "server-only";
import type { ManagedUser } from "@/common/types";
import { requireAdmin } from "./auth";
import { db } from "./db";

export async function getUsers(): Promise<ManagedUser[]> {
  await requireAdmin();
  const users = await db.user.findMany({
    select: { id: true, username: true, phone: true, role: true, loginAccount: true, createdAt: true, avatarUpdatedAt: true },
    orderBy: { createdAt: "desc" },
  });
  return users.map(({ loginAccount, avatarUpdatedAt, ...user }) => ({
    ...user,
    isBuiltIn: loginAccount === "admin",
    createdAt: user.createdAt.toISOString(),
    avatarUrl: avatarUpdatedAt ? `/api/users/${user.id}/avatar?v=${avatarUpdatedAt.getTime()}` : "",
  }));
}

