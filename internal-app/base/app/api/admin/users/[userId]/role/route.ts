import { NextResponse } from "next/server";
import type { UserRole } from "@/lib/auth/types";
import { requireApiAdmin, updateUserRole } from "@/lib/server/auth";
import { handleApiError } from "@/lib/server/http";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ userId: string }> }
) {
  try {
    const actor = await requireApiAdmin();
    const { userId } = await context.params;
    const body = await request.json();
    const role = body?.role as UserRole;
    const user = await updateUserRole(actor.id, userId, role);
    return NextResponse.json({ user });
  } catch (error) {
    return handleApiError(error);
  }
}
