import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/server/auth";
import { handleApiError } from "@/lib/server/http";
import { insertRecords } from "@/lib/server/repository";

export async function POST(
  request: Request,
  context: { params: Promise<{ tableId: string }> }
) {
  try {
    await requireApiUser();
    const { tableId } = await context.params;
    const body = await request.json().catch(() => ({}));
    const position = body?.position === "after" ? "after" : "before";
    const records = await insertRecords(
      tableId,
      String(body?.anchorRecordId ?? ""),
      position,
      Number(body?.count)
    );
    return NextResponse.json({ records }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
