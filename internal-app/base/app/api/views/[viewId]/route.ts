import { NextResponse } from "next/server";
import type { ViewConfig, ViewType } from "@/lib/bitable/types";
import { requireApiUser } from "@/lib/server/auth";
import { handleApiError } from "@/lib/server/http";
import { deleteView, updateView } from "@/lib/server/repository";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ viewId: string }> }
) {
  try {
    await requireApiUser();
    const { viewId } = await context.params;
    const body = await request.json();
    const view = await updateView(viewId, {
      name: body?.name !== undefined ? String(body.name) : undefined,
      type:
        body?.type !== undefined ? (String(body.type) as ViewType) : undefined,
      config:
        body?.config !== undefined ? (body.config as ViewConfig) : undefined,
    });
    return NextResponse.json({ view });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ viewId: string }> }
) {
  try {
    await requireApiUser();
    const { viewId } = await context.params;
    await deleteView(viewId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
