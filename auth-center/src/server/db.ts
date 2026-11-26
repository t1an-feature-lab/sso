import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { Prisma, PrismaClient } from "@/generated/prisma/client";

const globalForDb = globalThis as typeof globalThis & {
  authCenterPrisma?: PrismaClient;
};

// Model renames require the regenerated client during development hot reloads.
export const db = globalForDb.authCenterPrisma?.userApplicationAuthorization ? globalForDb.authCenterPrisma : new PrismaClient({
  adapter: new PrismaPg({
    connectionString: process.env.DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:5432/auth_center",
  }),
});

globalForDb.authCenterPrisma = db;

export async function serializableTransaction<T>(action: (transaction: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await db.$transaction(action, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      // Retry write conflicts so concurrent password and secret operations preserve their checks.
      if (attempt >= 4 || !(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2034") throw error;
    }
  }
}
