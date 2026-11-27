import { NextResponse } from "next/server";
import { getCurrentUser } from "@/server/auth";
import { handleApiError } from "@/server/http";

export async function GET() {
  try {
    const user = await getCurrentUser();
    return NextResponse.json({ user });
  } catch (error) {
    return handleApiError(error);
  }
}
