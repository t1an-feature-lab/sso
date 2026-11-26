import { getCurrentUser } from "@/server/auth";
import { db } from "@/server/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return new Response(null, { status: 401, headers: { "Cache-Control": "private, no-store" } });
  const { id } = await context.params;
  if (!/^[a-f\d]{8}-(?:[a-f\d]{4}-){3}[a-f\d]{12}$/i.test(id) || (user.role !== "admin" && id !== user.id)) {
    return new Response(null, { status: 404, headers: { "Cache-Control": "private, no-store" } });
  }
  const avatar = await db.user.findUnique({ where: { id }, select: { avatarData: true, avatarMime: true } });
  if (!avatar?.avatarData || !avatar.avatarMime || !["image/png", "image/jpeg", "image/webp"].includes(avatar.avatarMime)) {
    return new Response(null, { status: 404, headers: { "Cache-Control": "private, no-store" } });
  }
  return new Response(new Uint8Array(avatar.avatarData), { headers: {
    "Content-Type": avatar.avatarMime,
    "Content-Length": String(avatar.avatarData.length),
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": "default-src 'none'",
  } });
}
