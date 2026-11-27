import { NextResponse } from "next/server";
import { DEFAULT_USER_PASSWORD } from "@/lib/types";
import {
  getCurrentSessionHash,
  requireApiAdmin,
  resetUserPasswordByAdmin,
} from "@/server/auth";
import { handleApiError } from "@/server/http";

export async function POST(
  _request: Request,
  context: { params: Promise<{ userId: string }> }
) {
  try {
    const admin = await requireApiAdmin();
    const sessionHash = await getCurrentSessionHash();
    const { userId } = await context.params;
    const user = await resetUserPasswordByAdmin(admin.id, userId, sessionHash);
    return NextResponse.json({ user, password: DEFAULT_USER_PASSWORD });
  } catch (error) {
    return handleApiError(error);
  }
}
