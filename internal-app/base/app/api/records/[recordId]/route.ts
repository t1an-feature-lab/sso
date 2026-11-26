import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/server/auth";
import { handleApiError } from "@/lib/server/http";
import { getRecord } from "@/lib/server/records-query";
import { deleteRecord, updateRecord } from "@/lib/server/repository";

export async function GET(
  _request: Request,
  context: { params: Promise<{ recordId: string }> }
) {
  try {
    await requireApiUser();
    const { recordId } = await context.params;
    const record = await getRecord(recordId);
    return NextResponse.json({ record });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ recordId: string }> }
) {
  try {
    await requireApiUser();
    const { recordId } = await context.params;
    const body = await request.json();
    const record = await updateRecord(
      recordId,
      (body?.values ?? {}) as Record<string, unknown>
    );
    return NextResponse.json({ record });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ recordId: string }> }
) {
  try {
    await requireApiUser();
    const { recordId } = await context.params;
    await deleteRecord(recordId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
