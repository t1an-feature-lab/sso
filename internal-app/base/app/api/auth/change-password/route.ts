import { NextResponse } from "next/server";
import {
  changeOwnPassword,
  getCurrentSessionHash,
  requireApiUser,
} from "@/lib/server/auth";
import { handleApiError } from "@/lib/server/http";

export async function POST(request: Request) {
  try {
    const user = await requireApiUser();
    const sessionHash = await getCurrentSessionHash();
    const body = await request.json();
    await changeOwnPassword(user.id, sessionHash, {
      currentPassword:
        typeof body?.currentPassword === "string" ? body.currentPassword : "",
      newPassword:
        typeof body?.newPassword === "string" ? body.newPassword : "",
      confirmPassword:
        typeof body?.confirmPassword === "string" ? body.confirmPassword : "",
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
