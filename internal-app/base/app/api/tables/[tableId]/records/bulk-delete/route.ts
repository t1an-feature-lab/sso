import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/server/auth";
import { handleApiError } from "@/lib/server/http";
import { bulkDeleteRecords } from "@/lib/server/repository";

export async function POST(
  request: Request,
  context: { params: Promise<{ tableId: string }> }
) {
  try {
    await requireApiUser();
    const { tableId } = await context.params;
    const body = await request.json();
    const recordIds = Array.isArray(body?.recordIds)
      ? body.recordIds.map(String)
      : [];
    const deletedCount = await bulkDeleteRecords(tableId, recordIds);
    return NextResponse.json({ deletedCount });
  } catch (error) {
    return handleApiError(error);
  }
}
