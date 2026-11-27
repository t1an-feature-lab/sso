import { NextResponse } from "next/server";
import { requireApiAdmin } from "@/server/auth";
import { handleApiError } from "@/server/http";
import { getModelConfigApiKey } from "@/server/models";

export async function GET(
  _request: Request,
  context: { params: Promise<{ modelId: string }> }
) {
  try {
    await requireApiAdmin();
    const { modelId } = await context.params;
    const apiKey = await getModelConfigApiKey(modelId);
    return NextResponse.json(
      { apiKey },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    return handleApiError(error);
  }
}
