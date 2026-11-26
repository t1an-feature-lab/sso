import { NextResponse } from "next/server";
import { deleteSession } from "@/lib/server/auth";
import { handleApiError } from "@/lib/server/http";

export async function POST() {
  try {
    await deleteSession();
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
