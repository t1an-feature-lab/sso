import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { PrismaClient } from "@/generated/prisma/client";
import {
  BUILT_IN_ADMIN_INITIAL_PASSWORD,
  BUILT_IN_ADMIN_USERNAME,
} from "@/lib/types";
import { hashPassword } from "./password";

const PRISMA_CLIENT_SCHEMA_VERSION = "2026-11-27-chat-parts";

const globalForDb = globalThis as typeof globalThis & {
  agentBuilderPool?: Pool;
  agentBuilderPrisma?: PrismaClient;
  agentBuilderPrismaPool?: Pool;
  agentBuilderPrismaVersion?: string;
  agentBuilderAdminReady?: Promise<void>;
};

function databaseUrl(): string {
  return (
    process.env.DATABASE_URL ??
    "postgresql://postgres:postgres@127.0.0.1:5432/agent_builder"
  );
}

function getPool(): Pool {
  const current = globalForDb.agentBuilderPool;
  if (current && !current.ending && !current.ended) return current;
  const pool = new Pool({ connectionString: databaseUrl() });
  pool.on("error", () => undefined);
  globalForDb.agentBuilderPool = pool;
  return pool;
}

function createPrismaClient(pool: Pool): PrismaClient {
  return new PrismaClient({
    adapter: new PrismaPg(pool),
  });
}

function getOrCreateDb(): PrismaClient {
  const pool = getPool();
  const cached = globalForDb.agentBuilderPrisma;
  // Prisma returns a proxy, so instanceof does not reliably identify cached clients.
  if (
    cached &&
    globalForDb.agentBuilderPrismaPool === pool &&
    globalForDb.agentBuilderPrismaVersion === PRISMA_CLIENT_SCHEMA_VERSION &&
    typeof (cached as Partial<PrismaClient>).modelConfig?.findMany ===
      "function"
  ) {
    return cached;
  }
  const next = createPrismaClient(pool);
  if (cached) void cached.$disconnect().catch(() => undefined);
  globalForDb.agentBuilderPrisma = next;
  globalForDb.agentBuilderPrismaPool = pool;
  globalForDb.agentBuilderPrismaVersion = PRISMA_CLIENT_SCHEMA_VERSION;
  return next;
}

export function resetDatabaseClient(): void {
  const client = globalForDb.agentBuilderPrisma;
  const pool = globalForDb.agentBuilderPool;
  globalForDb.agentBuilderPool = undefined;
  globalForDb.agentBuilderPrisma = undefined;
  globalForDb.agentBuilderPrismaPool = undefined;
  globalForDb.agentBuilderPrismaVersion = undefined;
  globalForDb.agentBuilderAdminReady = undefined;
  if (client) void client.$disconnect().catch(() => undefined);
  if (pool && !pool.ending && !pool.ended) {
    void pool.end().catch(() => undefined);
  }
}

export function isDatabaseUnreachable(error: unknown): boolean {
  const message = error instanceof Error ? error.message : "";
  return (
    message.includes("Can't reach database server") ||
    message.includes("ECONNREFUSED") ||
    message.includes("Connection terminated") ||
    message.includes("Connection closed") ||
    message.includes("Cannot use a pool after calling end on the pool")
  );
}

export const db: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, property) {
    const client = getOrCreateDb();
    const value = Reflect.get(client, property, client);
    return typeof value === "function" ? value.bind(client) : value;
  },
});

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
      if (isDatabaseUnreachable(err)) resetDatabaseClient();
      else globalForDb.agentBuilderAdminReady = undefined;
      throw err;
    });
  }
  return globalForDb.agentBuilderAdminReady;
}
