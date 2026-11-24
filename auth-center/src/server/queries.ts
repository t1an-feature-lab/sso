import "server-only";
import { QueryTypes } from "sequelize";
import { applicationIdenticon } from "@/common/application-identicon";
import type { AuthorizedApplicationUser, ClientApplication, ClientApplicationDetail, ClientSecret, InternalApplication, ManagedUser, PublicUser } from "@/common/types";
import { requireAdmin, requireUser } from "./auth";
import { db } from "./db";

type ApplicationRow = Omit<ClientApplication, "createdAt" | "logoUrl"> & {
  createdAt: Date;
  logoUpdatedAt: Date | null;
};

const applicationColumns = `a.id, a.owner_id AS "ownerId", u.username AS "ownerName", a.protocol,
  a.name, a.client_id AS "clientId", a.redirect_uris AS "redirectUris", a.scopes, a.homepage, a.status,
  a.created_at AS "createdAt", a.logo_updated_at AS "logoUpdatedAt"`;

function serializeApplication(row: ApplicationRow): ClientApplication {
  const { logoUpdatedAt, ...application } = row;
  return {
    ...application,
    createdAt: application.createdAt.toISOString(),
    logoUrl: logoUpdatedAt ? `/api/applications/${application.id}/logo?v=${logoUpdatedAt.getTime()}` : applicationIdenticon(application.id),
  };
}

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

export async function getApplications(user: PublicUser, scope: "own" | "all" = "own"): Promise<ClientApplication[]> {
  // Re-read the session so callers cannot turn a supplied role into authorization.
  const currentUser = await requireUser();
  if (currentUser.id !== user.id) throw new Error("无权查看此账户的应用");
  const applications = await db.query<ApplicationRow>(`
    SELECT ${applicationColumns}
    FROM sso_client_applications a JOIN sso_users u ON u.id = a.owner_id
    ${scope === "all" && currentUser.role === "admin" ? "" : "WHERE a.owner_id = :userId"}
    ORDER BY a.created_at DESC
  `, { replacements: { userId: currentUser.id }, type: QueryTypes.SELECT });
  return applications.map(serializeApplication);
}

export async function getApplication(id: string, scope: "own" | "all" = "own"): Promise<ClientApplicationDetail | null> {
  const user = scope === "all" ? await requireAdmin() : await requireUser();
  if (!/^[a-f\d]{8}-(?:[a-f\d]{4}-){3}[a-f\d]{12}$/i.test(id)) return null;
  const [application] = await db.query<ApplicationRow>(`
    SELECT ${applicationColumns}
    FROM sso_client_applications a JOIN sso_users u ON u.id = a.owner_id
    WHERE a.id = :id ${scope === "all" ? "" : "AND a.owner_id = :userId"}
  `, { replacements: { id, userId: user.id }, type: QueryTypes.SELECT });
  if (!application) return null;
  const [clientSecrets, authorizedUsers] = await Promise.all([
    db.query<Omit<ClientSecret, "createdAt" | "lastUsedAt"> & { createdAt: Date; lastUsedAt: Date | null }>(`
      SELECT s.id, s.last_four AS "lastFour", (s.secret_encrypted IS NOT NULL) AS "canReveal",
        s.created_at AS "createdAt", COALESCE(u.username, '已删除用户') AS "createdBy", s.last_used_at AS "lastUsedAt"
      FROM sso_client_secrets s LEFT JOIN sso_users u ON u.id = s.created_by
      WHERE s.application_id = :id ORDER BY s.created_at DESC, s.id
    `, { replacements: { id }, type: QueryTypes.SELECT }),
    db.query<Omit<AuthorizedApplicationUser, "authorizedAt" | "lastUsedAt"> & { authorizedAt: Date; lastUsedAt: Date | null }>(`
      SELECT a.id, u.id AS "userId", u.username, u.phone, a.scopes,
        a.authorized_at AS "authorizedAt", a.last_used_at AS "lastUsedAt"
      FROM sso_client_authorizations a JOIN sso_users u ON u.id = a.user_id
      WHERE a.application_id = :id ORDER BY a.authorized_at DESC, a.id
    `, { replacements: { id }, type: QueryTypes.SELECT }),
  ]);
  return {
    ...serializeApplication(application),
    clientSecrets: clientSecrets.map((secret) => ({
      ...secret, createdAt: secret.createdAt.toISOString(), lastUsedAt: secret.lastUsedAt?.toISOString() ?? null,
    })),
    authorizedUsers: authorizedUsers.map((authorization) => ({
      ...authorization, authorizedAt: authorization.authorizedAt.toISOString(), lastUsedAt: authorization.lastUsedAt?.toISOString() ?? null,
    })),
  };
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
