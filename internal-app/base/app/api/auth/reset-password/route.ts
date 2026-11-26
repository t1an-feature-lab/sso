import { NextResponse } from "next/server";
import { DEFAULT_USER_PASSWORD } from "@/lib/auth/types";
import {
  getCurrentSessionHash,
  requireApiUser,
  resetOwnPassword,
} from "@/lib/server/auth";
import { handleApiError } from "@/lib/server/http";

export async function POST() {
  try {
    const user = await requireApiUser();
    const sessionHash = await getCurrentSessionHash();
    await resetOwnPassword(user.id, sessionHash);
    return NextResponse.json({
      ok: true,
      password: DEFAULT_USER_PASSWORD,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
