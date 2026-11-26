import { NextResponse } from "next/server";
import type { ViewConfig, ViewType } from "@/lib/bitable/types";
import { requireApiUser } from "@/lib/server/auth";
import { handleApiError } from "@/lib/server/http";
import { createView } from "@/lib/server/repository";

export async function POST(
  request: Request,
  context: { params: Promise<{ tableId: string }> }
) {
  try {
    await requireApiUser();
    const { tableId } = await context.params;
    const body = await request.json();
    const view = await createView(tableId, {
      name: String(body?.name ?? ""),
      type: String(body?.type ?? "grid") as ViewType,
      config: (body?.config ?? {}) as ViewConfig,
    });
    return NextResponse.json({ view }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
