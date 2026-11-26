import { NextResponse } from "next/server";
import type { FieldConfig, FieldType } from "@/lib/bitable/types";
import { requireApiUser } from "@/lib/server/auth";
import { handleApiError } from "@/lib/server/http";
import { createField } from "@/lib/server/repository";

export async function POST(
  request: Request,
  context: { params: Promise<{ tableId: string }> }
) {
  try {
    await requireApiUser();
    const { tableId } = await context.params;
    const body = await request.json();
    const field = await createField(tableId, {
      name: String(body?.name ?? ""),
      type: String(body?.type ?? "text") as FieldType,
      required: Boolean(body?.required),
      width: typeof body?.width === "number" ? body.width : undefined,
      config: (body?.config ?? {}) as FieldConfig,
    });
    return NextResponse.json({ field }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
