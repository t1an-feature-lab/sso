import "server-only";
import { QueryTypes } from "sequelize";
import type { InternalApplication, ManagedUser } from "@/common/types";
import { requireAdmin } from "./auth";
import { db } from "./db";

export async function getUsers(): Promise<ManagedUser[]> {
  await requireAdmin();
  const users = await db.query<Omit<ManagedUser, "createdAt" | "avatarUrl"> & { createdAt: Date; avatarUpdatedAt: Date | null }>(`
    SELECT id, username, phone, role, (login_account = 'admin') AS "isBuiltIn",
      created_at AS "createdAt", avatar_updated_at AS "avatarUpdatedAt"
    FROM sso_users ORDER BY created_at DESC
  `, { type: QueryTypes.SELECT });
  return users.map(({ avatarUpdatedAt, ...user }) => ({
    ...user,
    createdAt: user.createdAt.toISOString(),
    avatarUrl: avatarUpdatedAt ? `/api/users/${user.id}/avatar?v=${avatarUpdatedAt.getTime()}` : "",
  }));
}

export async function getInternalApplications(): Promise<InternalApplication[]> {
  await requireAdmin();
  const applications = await db.query<Omit<InternalApplication, "createdAt"> & { createdAt: Date }>(`
    SELECT id, name, homepage, status, created_at AS "createdAt"
    FROM sso_internal_applications ORDER BY created_at DESC
  `, { type: QueryTypes.SELECT });
  return applications.map((application) => ({ ...application, createdAt: application.createdAt.toISOString() }));
}

export async function getInternalApplication(id: string): Promise<InternalApplication | null> {
  await requireAdmin();
  if (!/^[a-f\d]{8}-(?:[a-f\d]{4}-){3}[a-f\d]{12}$/i.test(id)) return null;
  const [application] = await db.query<Omit<InternalApplication, "createdAt"> & { createdAt: Date }>(`
    SELECT id, name, homepage, status, created_at AS "createdAt"
    FROM sso_internal_applications WHERE id = :id
  `, { replacements: { id }, type: QueryTypes.SELECT });
  return application ? { ...application, createdAt: application.createdAt.toISOString() } : null;
}
