import "dotenv/config";
import { randomBytes, scryptSync } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const db = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: process.env.DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:5432/auth_center",
  }),
});

try {
  const salt = randomBytes(16).toString("hex");
  const passwordHash = `${salt}:${scryptSync("admin", salt, 64).toString("hex")}`;
  await db.user.upsert({
    where: { loginAccount: "admin" },
    update: {},
    create: { loginAccount: "admin", username: "admin", passwordHash, role: "admin" },
  });
  console.log("已初始化 admin 管理员");
} finally {
  await db.$disconnect();
}
