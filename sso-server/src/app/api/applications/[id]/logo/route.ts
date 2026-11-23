import { QueryTypes } from "sequelize";
import { getCurrentUser } from "@/server/auth";
import { db } from "@/server/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return new Response(null, { status: 401, headers: { "Cache-Control": "private, no-store" } });
  const { id } = await context.params;
  if (!/^[a-f\d]{8}-(?:[a-f\d]{4}-){3}[a-f\d]{12}$/i.test(id)) {
    return new Response(null, { status: 404, headers: { "Cache-Control": "private, no-store" } });
  }
  const [logo] = await db.query<{ data: Buffer | null; mime: string | null }>(`
    SELECT logo_data AS data, logo_mime AS mime FROM sso_client_applications
    WHERE id = :id ${user.role === "admin" ? "" : "AND owner_id = :ownerId"}
  `, { replacements: { id, ownerId: user.id }, type: QueryTypes.SELECT });
  if (!logo?.data || !logo.mime || !["image/png", "image/jpeg", "image/webp"].includes(logo.mime)) {
    return new Response(null, { status: 404, headers: { "Cache-Control": "private, no-store" } });
  }
  return new Response(new Uint8Array(logo.data), { headers: {
    "Content-Type": logo.mime,
    "Content-Length": String(logo.data.length),
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": "default-src 'none'",
  } });
}
