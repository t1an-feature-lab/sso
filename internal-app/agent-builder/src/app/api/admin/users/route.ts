import { NextResponse } from "next/server";
import { listUsersPage, requireApiAdmin } from "@/server/auth";
import { handleApiError } from "@/server/http";

export async function GET(request: Request) {
  try {
    await requireApiAdmin();
    const { searchParams } = new URL(request.url);
    const page = Number(searchParams.get("page") ?? "1");
    const pageSize = Number(searchParams.get("pageSize") ?? "10");
    const payload = await listUsersPage({
      page: Number.isFinite(page) ? page : 1,
      pageSize: Number.isFinite(pageSize) ? pageSize : 10,
    });
    return NextResponse.json(payload);
  } catch (error) {
    return handleApiError(error);
  }
}
