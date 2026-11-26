import { NextResponse } from "next/server";
import { DEFAULT_USER_PASSWORD } from "@/lib/auth/types";
import {
  getCurrentSessionHash,
  requireApiAdmin,
  resetUserPasswordByAdmin,
} from "@/lib/server/auth";
import { handleApiError } from "@/lib/server/http";

export async function POST(
  _request: Request,
  context: { params: Promise<{ userId: string }> }
) {
  try {
    const actor = await requireApiAdmin();
    const sessionHash = await getCurrentSessionHash();
    const { userId } = await context.params;
    const user = await resetUserPasswordByAdmin(actor.id, userId, sessionHash);
    return NextResponse.json({
      user,
      password: DEFAULT_USER_PASSWORD,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
