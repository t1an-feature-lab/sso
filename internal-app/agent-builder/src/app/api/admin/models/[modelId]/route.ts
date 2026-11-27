import { NextResponse } from "next/server";
import { requireApiAdmin } from "@/server/auth";
import { handleApiError, HttpError } from "@/server/http";
import { deleteModelConfig, updateModelConfig } from "@/server/models";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ modelId: string }> }
) {
  try {
    await requireApiAdmin();
    const { modelId } = await context.params;
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      throw new HttpError(400, "请求参数无效");
    }
    const model = await updateModelConfig(modelId, body);
    return NextResponse.json({ model });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ modelId: string }> }
) {
  try {
    await requireApiAdmin();
    const { modelId } = await context.params;
    await deleteModelConfig(modelId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
