import { NextResponse } from "next/server";
import { loginOrRegister } from "@/lib/server/auth";
import { handleApiError } from "@/lib/server/http";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = await loginOrRegister({
      username: typeof body?.username === "string" ? body.username : "",
      password: typeof body?.password === "string" ? body.password : "",
    });
    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}
