import { NextResponse } from "next/server";
import { requireApiUser } from "@/server/auth";
import { handleApiError } from "@/server/http";
import { listAvailableModels } from "@/server/models";

export async function GET() {
  try {
    await requireApiUser();
    const models = await listAvailableModels();
    return NextResponse.json({ models });
  } catch (error) {
    return handleApiError(error);
  }
}
