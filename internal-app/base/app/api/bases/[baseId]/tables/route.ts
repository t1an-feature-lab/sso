import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/server/auth";
import { handleApiError } from "@/lib/server/http";
import { createTable } from "@/lib/server/repository";

export async function POST(
  request: Request,
  context: { params: Promise<{ baseId: string }> }
) {
  try {
    await requireApiUser();
    const { baseId } = await context.params;
    const body = await request.json();
    const table = await createTable(baseId, {
      name: String(body?.name ?? ""),
      description: body?.description ? String(body.description) : "",
    });
    return NextResponse.json({ table }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
