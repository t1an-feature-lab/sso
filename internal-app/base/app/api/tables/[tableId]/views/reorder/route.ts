import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/server/auth";
import { handleApiError } from "@/lib/server/http";
import { reorderViews } from "@/lib/server/reorder";

export async function POST(
  request: Request,
  context: { params: Promise<{ tableId: string }> }
) {
  try {
    await requireApiUser();
    const { tableId } = await context.params;
    const body = await request.json().catch(() => ({}));
    const viewIds = Array.isArray(body?.viewIds)
      ? body.viewIds.map(String)
      : [];
    await reorderViews(tableId, viewIds);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
