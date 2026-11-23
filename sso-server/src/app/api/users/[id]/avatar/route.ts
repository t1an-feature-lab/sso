import { QueryTypes } from "sequelize";
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
  const [avatar] = await db.query<{ data: Buffer | null; mime: string | null }>(`
    SELECT avatar_data AS data, avatar_mime AS mime FROM sso_users WHERE id = :id
  `, { replacements: { id }, type: QueryTypes.SELECT });
  if (!avatar?.data || !avatar.mime || !["image/png", "image/jpeg", "image/webp"].includes(avatar.mime)) {
    return new Response(null, { status: 404, headers: { "Cache-Control": "private, no-store" } });
  }
  return new Response(new Uint8Array(avatar.data), { headers: {
    "Content-Type": avatar.mime,
    "Content-Length": String(avatar.data.length),
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": "default-src 'none'",
  } });
}
