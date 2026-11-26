import { NextResponse } from "next/server";
import { HttpError } from "./repository";

export function handleApiError(error: unknown) {
  if (error instanceof HttpError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  const message =
    error instanceof Error && error.message ? error.message : "服务器内部错误";
  return NextResponse.json({ error: message }, { status: 500 });
}
