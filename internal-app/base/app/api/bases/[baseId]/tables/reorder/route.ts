import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/server/auth";
import { handleApiError } from "@/lib/server/http";
import { reorderTables } from "@/lib/server/reorder";

export async function POST(
  request: Request,
  context: { params: Promise<{ baseId: string }> }
) {
  try {
    await requireApiUser();
    const { baseId } = await context.params;
    const body = await request.json().catch(() => ({}));
    const tableIds = Array.isArray(body?.tableIds)
      ? body.tableIds.map(String)
      : [];
    await reorderTables(baseId, tableIds);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
