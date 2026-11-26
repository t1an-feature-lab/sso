import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { applicationIdenticon } from "@/common/application-identicon";
import type { ClientApplication, ClientApplicationDetail, PublicUser } from "@/common/types";
import { requireAdmin, requireUser } from "../auth";
import { db } from "../db";

const applicationSelect = {
  id: true, ownerId: true, owner: { select: { username: true } }, name: true, clientId: true,
  redirectUris: true, scopes: true, homepage: true, status: true, createdAt: true, logoUpdatedAt: true,
} satisfies Prisma.ApplicationSelect;

function serializeApplication(row: Prisma.ApplicationGetPayload<{ select: typeof applicationSelect }>): ClientApplication {
  const { owner, logoUpdatedAt, ...application } = row;
  return {
    ...application,
    ownerName: owner.username,
    createdAt: application.createdAt.toISOString(),
    logoUrl: logoUpdatedAt ? `/api/applications/${application.id}/logo?v=${logoUpdatedAt.getTime()}` : applicationIdenticon(application.id),
  };
}

export async function getApplications(user: PublicUser, scope: "own" | "all" = "own"): Promise<ClientApplication[]> {
  const currentUser = await requireUser();
  if (currentUser.id !== user.id) throw new Error("无权查看此账户的应用");
  const applications = await db.application.findMany({
    where: scope === "all" && currentUser.role === "admin" ? {} : { ownerId: currentUser.id },
    select: applicationSelect,
    orderBy: { createdAt: "desc" },
  });
  return applications.map(serializeApplication);
}

export async function getApplication(id: string, scope: "own" | "all" = "own"): Promise<ClientApplicationDetail | null> {
  const user = scope === "all" ? await requireAdmin() : await requireUser();
  if (!/^[a-f\d]{8}-(?:[a-f\d]{4}-){3}[a-f\d]{12}$/i.test(id)) return null;
  const application = await db.application.findFirst({
    where: { id, ...(scope === "all" ? {} : { ownerId: user.id }) },
    select: {
      ...applicationSelect,
      clientSecrets: {
        select: { id: true, lastFour: true, createdAt: true, lastUsedAt: true, creator: { select: { username: true } } },
        orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      },
      authorizations: {
        select: {
          id: true, userId: true, scopes: true, authorizedAt: true, lastUsedAt: true,
          user: { select: { username: true, phone: true } },
        },
        orderBy: [{ authorizedAt: "desc" }, { id: "asc" }],
      },
    },
  });
  if (!application) return null;
  const { clientSecrets, authorizations, ...row } = application;
  return {
    ...serializeApplication(row),
    clientSecrets: clientSecrets.map(({ creator, ...secret }) => ({
      ...secret,
      canReveal: true,
      createdBy: creator?.username ?? "已删除用户",
      createdAt: secret.createdAt.toISOString(),
      lastUsedAt: secret.lastUsedAt?.toISOString() ?? null,
    })),
    authorizedUsers: authorizations.map(({ user, ...authorization }) => ({
      ...authorization,
      username: user.username,
      phone: user.phone,
      authorizedAt: authorization.authorizedAt.toISOString(),
      lastUsedAt: authorization.lastUsedAt?.toISOString() ?? null,
    })),
  };
}
