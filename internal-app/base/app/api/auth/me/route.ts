import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/server/auth";
import { handleApiError } from "@/lib/server/http";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "请先登录" }, { status: 401 });
    }
    return NextResponse.json({ user });
  } catch (error) {
    return handleApiError(error);
  }
}
