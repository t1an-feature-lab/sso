import { NextResponse } from "next/server";
import { DEFAULT_USER_PASSWORD } from "@/lib/types";
import {
  getCurrentSessionHash,
  requireApiUser,
  resetOwnPassword,
} from "@/server/auth";
import { handleApiError } from "@/server/http";

export async function POST() {
  try {
    const user = await requireApiUser();
    const sessionHash = await getCurrentSessionHash();
    await resetOwnPassword(user.id, sessionHash);
    return NextResponse.json({ ok: true, password: DEFAULT_USER_PASSWORD });
  } catch (error) {
    return handleApiError(error);
  }
}
