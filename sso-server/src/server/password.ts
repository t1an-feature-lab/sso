import "server-only";
import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const deriveKey = promisify(scrypt);

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const key = (await deriveKey(password, salt, 64)) as Buffer;
  return `${salt}:${key.toString("hex")}`;
}

export async function verifyPassword(password: string, hash: string) {
  const [salt, encoded] = hash.split(":");
  if (!salt || !encoded || !/^[a-f0-9]{128}$/.test(encoded)) return false;
  const expected = Buffer.from(encoded, "hex");
  const key = (await deriveKey(password, salt, expected.length)) as Buffer;
  return timingSafeEqual(expected, key);
}
