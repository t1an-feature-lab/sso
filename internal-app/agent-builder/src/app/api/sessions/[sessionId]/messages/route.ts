import { NextResponse } from "next/server";
import { requireApiUser } from "@/server/auth";
import { handleApiError, HttpError } from "@/server/http";
import { appendChatMessage } from "@/server/sessions";

export async function POST(
  request: Request,
  context: { params: Promise<{ sessionId: string }> }
) {
  try {
    const user = await requireApiUser();
    const { sessionId } = await context.params;
    const body = (await request.json().catch(() => null)) as {
      content?: unknown;
    } | null;
    if (!body || typeof body.content !== "string") {
      throw new HttpError(400, "请输入消息内容");
    }
    const session = await appendChatMessage(user.id, sessionId, body.content);
    return NextResponse.json({ session });
  } catch (error) {
    return handleApiError(error);
  }
}
