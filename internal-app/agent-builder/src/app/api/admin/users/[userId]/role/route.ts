import { NextResponse } from "next/server";
import type { UserRole } from "@/lib/types";
import { requireApiAdmin, updateUserRole } from "@/server/auth";
import { handleApiError, HttpError } from "@/server/http";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ userId: string }> }
) {
  try {
    const admin = await requireApiAdmin();
    const { userId } = await context.params;
    const body = (await request.json().catch(() => null)) as {
      role?: unknown;
    } | null;
    if (!body || (body.role !== "admin" && body.role !== "user")) {
      throw new HttpError(400, "无效的用户角色");
    }
    const user = await updateUserRole(admin.id, userId, body.role as UserRole);
    return NextResponse.json({ user });
  } catch (error) {
    return handleApiError(error);
  }
}
