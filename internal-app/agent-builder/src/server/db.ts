import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import {
  BUILT_IN_ADMIN_INITIAL_PASSWORD,
  BUILT_IN_ADMIN_USERNAME,
} from "@/lib/types";
import { hashPassword } from "./password";

const PRISMA_CLIENT_SCHEMA_VERSION = "2026-11-27-model-provider-icon";

const globalForDb = globalThis as typeof globalThis & {
  agentBuilderPrisma?: PrismaClient;
  agentBuilderPrismaVersion?: string;
  agentBuilderAdminReady?: Promise<void>;
};

function createPrismaClient(): PrismaClient {
  return new PrismaClient({
    adapter: new PrismaPg({
      connectionString:
        process.env.DATABASE_URL ??
        "postgresql://postgres:postgres@127.0.0.1:5432/agent_builder",
    }),
  });
}

function getOrCreateDb(): PrismaClient {
  const cached = globalForDb.agentBuilderPrisma;
  if (
    cached instanceof PrismaClient &&
    globalForDb.agentBuilderPrismaVersion === PRISMA_CLIENT_SCHEMA_VERSION &&
    typeof (cached as Partial<PrismaClient>).modelConfig?.findMany ===
      "function"
  ) {
    return cached;
  }
  if (cached) {
    void cached.$disconnect().catch(() => undefined);
  }
  const next = createPrismaClient();
  globalForDb.agentBuilderPrisma = next;
  globalForDb.agentBuilderPrismaVersion = PRISMA_CLIENT_SCHEMA_VERSION;
  return next;
}

export const db = getOrCreateDb();

export function ensureBuiltInAdmin(): Promise<void> {
  if (!globalForDb.agentBuilderAdminReady) {
    globalForDb.agentBuilderAdminReady = (async () => {
      const existing =
        (await db.user.findFirst({
          where: { isBuiltIn: true },
          select: { id: true, role: true, isBuiltIn: true },
        })) ??
        (await db.user.findUnique({
          where: { username: BUILT_IN_ADMIN_USERNAME },
          select: { id: true, role: true, isBuiltIn: true },
        }));
      if (!existing) {
        const passwordHash = await hashPassword(BUILT_IN_ADMIN_INITIAL_PASSWORD);
        await db.user
          .create({
            data: {
              username: BUILT_IN_ADMIN_USERNAME,
              passwordHash,
              role: "admin",
              isBuiltIn: true,
            },
          })
          .catch(() => undefined);
      } else if (!existing.isBuiltIn || existing.role !== "admin") {
        await db.user.update({
          where: { id: existing.id },
          data: { role: "admin", isBuiltIn: true },
        });
      }
    })().catch((err) => {
      globalForDb.agentBuilderAdminReady = undefined;
      throw err;
    });
  }
  return globalForDb.agentBuilderAdminReady;
}
