import { NextResponse } from "next/server";
import { listUsersPage, requireApiAdmin } from "@/lib/server/auth";
import { handleApiError } from "@/lib/server/http";

export async function GET(request: Request) {
  try {
    await requireApiAdmin();
    const { searchParams } = new URL(request.url);
    const pageParam = searchParams.get("page");
    const pageSizeParam = searchParams.get("pageSize");
    const data = await listUsersPage({
      page: pageParam ? Number(pageParam) : undefined,
      pageSize: pageSizeParam ? Number(pageSizeParam) : undefined,
    });
    return NextResponse.json(data);
  } catch (error) {
    return handleApiError(error);
  }
}
