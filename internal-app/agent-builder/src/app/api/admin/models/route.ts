import { NextResponse } from "next/server";
import { requireApiAdmin } from "@/server/auth";
import { handleApiError, HttpError } from "@/server/http";
import { createModelConfig, listModelConfigs } from "@/server/models";

export async function GET() {
  try {
    await requireApiAdmin();
    const models = await listModelConfigs();
    return NextResponse.json({ models });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    await requireApiAdmin();
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      throw new HttpError(400, "请求参数无效");
    }
    const model = await createModelConfig(body);
    return NextResponse.json({ model }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
