import { NextResponse } from "next/server";
import {
  changeOwnPassword,
  getCurrentSessionHash,
  requireApiUser,
} from "@/server/auth";
import { handleApiError, HttpError } from "@/server/http";

export async function POST(request: Request) {
  try {
    const user = await requireApiUser();
    const sessionHash = await getCurrentSessionHash();
    const body = (await request.json().catch(() => null)) as {
      currentPassword?: unknown;
      newPassword?: unknown;
      confirmPassword?: unknown;
    } | null;
    if (!body || typeof body !== "object") {
      throw new HttpError(400, "请求参数无效");
    }
    await changeOwnPassword(user.id, sessionHash, {
      currentPassword:
        typeof body.currentPassword === "string" ? body.currentPassword : "",
      newPassword: typeof body.newPassword === "string" ? body.newPassword : "",
      confirmPassword:
        typeof body.confirmPassword === "string" ? body.confirmPassword : "",
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
