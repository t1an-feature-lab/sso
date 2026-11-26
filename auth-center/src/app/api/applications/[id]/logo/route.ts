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
  const logo = await db.application.findFirst({
    where: { id, ...(user.role === "admin" ? {} : { ownerId: user.id }) },
    select: { logoData: true, logoMime: true },
  });
  if (!logo?.logoData || !logo.logoMime || !["image/png", "image/jpeg", "image/webp"].includes(logo.logoMime)) {
    return new Response(null, { status: 404, headers: { "Cache-Control": "private, no-store" } });
  }
  return new Response(new Uint8Array(logo.logoData), { headers: {
    "Content-Type": logo.logoMime,
    "Content-Length": String(logo.logoData.length),
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": "default-src 'none'",
  } });
}
