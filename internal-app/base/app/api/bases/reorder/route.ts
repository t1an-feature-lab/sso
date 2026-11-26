import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/server/auth";
import { handleApiError } from "@/lib/server/http";
import { reorderBases } from "@/lib/server/reorder";

export async function POST(request: Request) {
  try {
    await requireApiUser();
    const body = await request.json().catch(() => ({}));
    const baseIds = Array.isArray(body?.baseIds)
      ? body.baseIds.map(String)
      : [];
    await reorderBases(baseIds);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
