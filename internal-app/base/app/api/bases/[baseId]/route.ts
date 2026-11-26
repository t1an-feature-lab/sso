import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/server/auth";
import { handleApiError } from "@/lib/server/http";
import { deleteBase, getBaseDetail, updateBase } from "@/lib/server/repository";

export async function GET(
  _request: Request,
  context: { params: Promise<{ baseId: string }> }
) {
  try {
    await requireApiUser();
    const { baseId } = await context.params;
    const data = await getBaseDetail(baseId);
    return NextResponse.json(data);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ baseId: string }> }
) {
  try {
    await requireApiUser();
    const { baseId } = await context.params;
    const body = await request.json();
    const base = await updateBase(baseId, {
      name: body?.name !== undefined ? String(body.name) : undefined,
      description:
        body?.description !== undefined ? String(body.description) : undefined,
      iconColor:
        body?.iconColor !== undefined ? String(body.iconColor) : undefined,
    });
    return NextResponse.json({ base });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ baseId: string }> }
) {
  try {
    await requireApiUser();
    const { baseId } = await context.params;
    await deleteBase(baseId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
