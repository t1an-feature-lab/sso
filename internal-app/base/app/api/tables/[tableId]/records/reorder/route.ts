import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/server/auth";
import { handleApiError } from "@/lib/server/http";
import { reorderRecords } from "@/lib/server/reorder";

export async function POST(
  request: Request,
  context: { params: Promise<{ tableId: string }> }
) {
  try {
    await requireApiUser();
    const { tableId } = await context.params;
    const body = await request.json().catch(() => ({}));
    const items = Array.isArray(body?.items)
      ? body.items.flatMap((item: { id?: unknown; sortOrder?: unknown }) => {
          if (!item || typeof item.id !== "string") return [];
          const sortOrder = Number(item.sortOrder);
          if (!Number.isFinite(sortOrder)) return [];
          return [{ id: item.id, sortOrder }];
        })
      : [];
    await reorderRecords(tableId, items);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
