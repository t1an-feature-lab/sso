import { NextResponse } from "next/server";
import { deleteUserByAdmin, requireApiAdmin } from "@/lib/server/auth";
import { handleApiError } from "@/lib/server/http";

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ userId: string }> }
) {
  try {
    const actor = await requireApiAdmin();
    const { userId } = await context.params;
    await deleteUserByAdmin(actor.id, userId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
