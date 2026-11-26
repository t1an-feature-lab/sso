import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/server/auth";
import { handleApiError } from "@/lib/server/http";
import {
  deleteTable,
  getTableDetail,
  updateTable,
} from "@/lib/server/repository";

export async function GET(
  _request: Request,
  context: { params: Promise<{ tableId: string }> }
) {
  try {
    await requireApiUser();
    const { tableId } = await context.params;
    const detail = await getTableDetail(tableId);
    return NextResponse.json(detail);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ tableId: string }> }
) {
  try {
    await requireApiUser();
    const { tableId } = await context.params;
    const body = await request.json();
    const table = await updateTable(tableId, {
      name: body?.name !== undefined ? String(body.name) : undefined,
      description:
        body?.description !== undefined ? String(body.description) : undefined,
    });
    return NextResponse.json({ table });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ tableId: string }> }
) {
  try {
    await requireApiUser();
    const { tableId } = await context.params;
    await deleteTable(tableId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
