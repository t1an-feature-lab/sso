import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { randomBytes, scrypt } from "node:crypto";
import { promisify } from "node:util";
import { PrismaClient } from "../src/generated/prisma/client";

const deriveKey = promisify(scrypt);

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const key = (await deriveKey(password, salt, 64)) as Buffer;
  return `${salt}:${key.toString("hex")}`;
}

async function main() {
  const connectionString =
    process.env.DATABASE_URL ??
    "postgresql://postgres:postgres@127.0.0.1:5432/agent_builder";
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  });

  try {
    const existing = await prisma.user.findUnique({
      where: { username: "admin" },
    });

    if (!existing) {
      const passwordHash = await hashPassword("admin");
      await prisma.user.create({
        data: {
          username: "admin",
          passwordHash,
          role: "admin",
          isBuiltIn: true,
        },
      });
      console.log("Created built-in admin user (admin / admin)");
    } else if (!existing.isBuiltIn || existing.role !== "admin") {
      await prisma.user.update({
        where: { id: existing.id },
        data: { role: "admin", isBuiltIn: true },
      });
      console.log("Ensured built-in admin user role");
    } else {
      console.log("Built-in admin user already exists");
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
