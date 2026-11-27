import "server-only";
import { randomBytes } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  MAX_CHAT_IMAGE_BYTES,
  MAX_CHAT_IMAGES,
  VISION_IMAGE_MIME_TYPES,
  type ChatImagePart,
} from "@/lib/types";
import { HttpError } from "./http";

const IMAGE_ID_RE = /^[a-f0-9]{16}$/;
const MESSAGE_ID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const VISION_TYPES = new Set<string>(VISION_IMAGE_MIME_TYPES);

export type ParsedChatImage = {
  name: string;
  mediaType: string;
  bytes: Buffer;
};

export type StoredChatImage = {
  type: "image";
  id: string;
  mediaType: string;
  name: string;
};

function imageRoot(): string {
  return path.resolve(process.cwd(), "storage", "message-images");
}

function assertMessageId(messageId: string): void {
  if (!MESSAGE_ID_RE.test(messageId)) {
    throw new HttpError(400, "图片无法识别");
  }
}

function imageDirectory(messageId: string): string {
  assertMessageId(messageId);
  const root = imageRoot();
  const dir = path.resolve(root, messageId);
  const relative = path.relative(root, dir);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new HttpError(400, "图片无法识别");
  }
  return dir;
}

function sniffMediaType(bytes: Buffer): string | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return "image/png";
  }
  if (bytes.length >= 6 && bytes.subarray(0, 6).toString("ascii").startsWith("GIF8")) {
    return "image/gif";
  }
  if (
    bytes.length >= 12 &&
    bytes.subarray(0, 4).toString("ascii") === "RIFF" &&
    bytes.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return "image/webp";
  }
  return null;
}

function imageName(value: unknown): string {
  const raw = typeof value === "string" ? value : "";
  const base = path.basename(raw.replace(/\\/g, "/")).replace(/[\u0000-\u001f]/g, "").trim();
  return (base || "图片").slice(0, 120);
}

export function parseChatImages(value: unknown): ParsedChatImage[] {
  if (value == null) return [];
  if (!Array.isArray(value)) {
    throw new HttpError(400, "图片无法识别");
  }
  if (value.length > MAX_CHAT_IMAGES) {
    throw new HttpError(400, "最多添加 6 张图片");
  }
  return value.map((item) => {
    if (!item || typeof item !== "object") {
      throw new HttpError(400, "图片无法识别");
    }
    const record = item as { name?: unknown; mediaType?: unknown; data?: unknown };
    const mediaType =
      typeof record.mediaType === "string"
        ? record.mediaType.split(";")[0]?.trim().toLowerCase()
        : "";
    if (!mediaType || !VISION_TYPES.has(mediaType) || typeof record.data !== "string") {
      throw new HttpError(400, "图片无法识别");
    }
    const encoded = record.data.replace(/\s/g, "");
    if (!encoded || encoded.length > Math.ceil(MAX_CHAT_IMAGE_BYTES / 3) * 4 + 8) {
      throw new HttpError(400, "单张图片不能超过 4 MB");
    }
    const bytes = Buffer.from(encoded, "base64");
    if (bytes.length === 0 || bytes.length > MAX_CHAT_IMAGE_BYTES) {
      throw new HttpError(400, "单张图片不能超过 4 MB");
    }
    const sniffed = sniffMediaType(bytes);
    if (!sniffed || sniffed !== mediaType) {
      throw new HttpError(400, "图片无法识别");
    }
    return { name: imageName(record.name), mediaType: sniffed, bytes };
  });
}

export function imagePartsFromJson(value: unknown): StoredChatImage[] {
  if (!Array.isArray(value)) return [];
  const images: StoredChatImage[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const record = item as { type?: unknown; id?: unknown; mediaType?: unknown; name?: unknown };
    if (typeof record.id !== "string" || !IMAGE_ID_RE.test(record.id)) continue;
    if (record.type != null && record.type !== "image") continue;
    const mediaType =
      typeof record.mediaType === "string" ? record.mediaType.toLowerCase() : "";
    if (!VISION_TYPES.has(mediaType)) continue;
    images.push({
      type: "image",
      id: record.id,
      mediaType,
      name: imageName(record.name),
    });
  }
  return images;
}

export function toChatImagePart(
  image: StoredChatImage,
  sessionId: string,
  messageId: string
): ChatImagePart {
  return {
    type: "image",
    id: image.id,
    mediaType: image.mediaType,
    name: image.name,
    url: `/api/sessions/${encodeURIComponent(sessionId)}/messages/${encodeURIComponent(messageId)}/images/${encodeURIComponent(image.id)}`,
  };
}

export async function saveChatImages(
  messageId: string,
  images: ParsedChatImage[]
): Promise<StoredChatImage[]> {
  if (images.length === 0) return [];
  const dir = imageDirectory(messageId);
  await mkdir(dir, { recursive: true });
  const saved: StoredChatImage[] = [];
  try {
    for (const image of images) {
      const id = randomBytes(8).toString("hex");
      await writeFile(path.join(dir, id), image.bytes);
      saved.push({
        type: "image",
        id,
        mediaType: image.mediaType,
        name: image.name,
      });
    }
    return saved;
  } catch (error) {
    await rm(dir, { recursive: true, force: true });
    throw error;
  }
}

export async function readChatImage(
  messageId: string,
  imageId: string
): Promise<Buffer> {
  if (!IMAGE_ID_RE.test(imageId)) {
    throw new HttpError(404, "图片不存在");
  }
  const dir = imageDirectory(messageId);
  const file = path.resolve(dir, imageId);
  const relative = path.relative(dir, file);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new HttpError(404, "图片不存在");
  }
  try {
    return await readFile(file);
  } catch {
    throw new HttpError(404, "图片不存在");
  }
}

export async function deleteChatImages(messageId: string): Promise<void> {
  if (!MESSAGE_ID_RE.test(messageId)) return;
  await rm(imageDirectory(messageId), { recursive: true, force: true });
}
