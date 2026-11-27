import { NextResponse } from "next/server";
import { requireApiUser } from "@/server/auth";
import { handleApiError, HttpError } from "@/server/http";
import { setDefaultAvailableModel } from "@/server/models";

export async function PATCH(request: Request) {
  try {
    await requireApiUser();
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      throw new HttpError(400, "请求参数无效");
    }
    const modelId = (body as { modelId?: unknown }).modelId;
    if (typeof modelId !== "string" || !modelId.trim()) {
      throw new HttpError(400, "请选择有效的模型");
    }
    const model = await setDefaultAvailableModel(modelId);
    return NextResponse.json({ model });
  } catch (error) {
    return handleApiError(error);
  }
}
