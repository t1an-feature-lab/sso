import { NextResponse } from "next/server";
import { requireApiUser } from "@/server/auth";
import { handleApiError, HttpError } from "@/server/http";
import {
  deleteChatSession,
  getChatSession,
  renameChatSession,
} from "@/server/sessions";

export async function GET(
  _request: Request,
  context: { params: Promise<{ sessionId: string }> }
) {
  try {
    const user = await requireApiUser();
    const { sessionId } = await context.params;
    const session = await getChatSession(user.id, sessionId);
    if (!session) {
      throw new HttpError(404, "对话会话不存在");
    }
    return NextResponse.json({ session });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ sessionId: string }> }
) {
  try {
    const user = await requireApiUser();
    const { sessionId } = await context.params;
    const body = (await request.json().catch(() => null)) as {
      title?: unknown;
    } | null;
    if (!body || typeof body.title !== "string") {
      throw new HttpError(400, "请输入会话名称");
    }
    const session = await renameChatSession(user.id, sessionId, body.title);
    return NextResponse.json({ session });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ sessionId: string }> }
) {
  try {
    const user = await requireApiUser();
    const { sessionId } = await context.params;
    await deleteChatSession(user.id, sessionId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
