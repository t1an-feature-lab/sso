import { NextResponse } from "next/server";
import { deleteUserByAdmin, requireApiAdmin } from "@/server/auth";
import { handleApiError } from "@/server/http";

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ userId: string }> }
) {
  try {
    const admin = await requireApiAdmin();
    const { userId } = await context.params;
    await deleteUserByAdmin(admin.id, userId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
