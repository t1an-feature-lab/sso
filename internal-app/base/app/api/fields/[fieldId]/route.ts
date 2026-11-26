import { NextResponse } from "next/server";
import type { FieldConfig, FieldType } from "@/lib/bitable/types";
import { requireApiUser } from "@/lib/server/auth";
import { handleApiError } from "@/lib/server/http";
import { deleteField, updateField } from "@/lib/server/repository";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ fieldId: string }> }
) {
  try {
    await requireApiUser();
    const { fieldId } = await context.params;
    const body = await request.json();
    const field = await updateField(fieldId, {
      name: body?.name !== undefined ? String(body.name) : undefined,
      type:
        body?.type !== undefined ? (String(body.type) as FieldType) : undefined,
      required:
        body?.required !== undefined ? Boolean(body.required) : undefined,
      width: typeof body?.width === "number" ? body.width : undefined,
      config:
        body?.config !== undefined ? (body.config as FieldConfig) : undefined,
    });
    return NextResponse.json({ field });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ fieldId: string }> }
) {
  try {
    await requireApiUser();
    const { fieldId } = await context.params;
    await deleteField(fieldId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
