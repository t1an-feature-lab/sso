import { NextResponse } from "next/server";
import { loginOrRegister } from "@/server/auth";
import { handleApiError, HttpError } from "@/server/http";

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as {
      username?: unknown;
      password?: unknown;
    } | null;
    if (!body || typeof body !== "object") {
      throw new HttpError(400, "请求参数无效");
    }
    const result = await loginOrRegister({
      username: typeof body.username === "string" ? body.username : "",
      password: typeof body.password === "string" ? body.password : "",
    });
    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}
