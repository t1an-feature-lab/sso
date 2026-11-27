import { NextResponse } from "next/server";
import { MAX_AVATAR_SIZE_BYTES } from "@/lib/types";
import { requireApiUser } from "@/server/auth";
import { handleApiError, HttpError } from "@/server/http";
import { updateOwnProfile } from "@/server/profile";

function detectImageMime(bytes: Uint8Array): string | null {
  if (bytes.length < 12) return null;
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return "image/png";
  }
  // JPEG: FF D8 FF
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  // WebP: RIFF....WEBP
  if (
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return "image/webp";
  }
  return null;
}

export async function PATCH(request: Request) {
  try {
    const user = await requireApiUser();
    const formData = await request.formData();
    const rawUsername = formData.get("username");
    const username = typeof rawUsername === "string" ? rawUsername : "";
    const removeAvatar = formData.get("removeAvatar") === "true";
    const avatarEntry = formData.get("avatar");

    let avatar: { data: Uint8Array; mime: string } | null = null;
    if (avatarEntry instanceof File && avatarEntry.size > 0) {
      if (avatarEntry.size > MAX_AVATAR_SIZE_BYTES) {
        throw new HttpError(400, "头像图片大小不能超过 5 MB");
      }
      const bytes = new Uint8Array(await avatarEntry.arrayBuffer());
      const detectedMime = detectImageMime(bytes);
      if (!detectedMime) {
        throw new HttpError(400, "仅支持 PNG、JPEG 或 WebP 格式的图片");
      }
      avatar = { data: bytes, mime: detectedMime };
    }

    const updated = await updateOwnProfile(user.id, {
      username,
      avatar,
      removeAvatar: !avatar && removeAvatar,
    });

    return NextResponse.json({ user: updated });
  } catch (error) {
    return handleApiError(error);
  }
}
