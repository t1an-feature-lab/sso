import { NextResponse } from "next/server";
import { deleteSession } from "@/server/auth";
import { handleApiError } from "@/server/http";

export async function POST() {
  try {
    await deleteSession();
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
