import { NextResponse } from "next/server";
import { requireApiUser } from "@/server/auth";
import { handleApiError, HttpError } from "@/server/http";
import { parseChatImages } from "@/server/message-images";
import { createChatSession, listChatSessions } from "@/server/sessions";

export async function GET() {
  try {
    const user = await requireApiUser();
    const sessions = await listChatSessions(user.id);
    return NextResponse.json({ sessions });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireApiUser();
    const body = (await request.json().catch(() => null)) as {
      prompt?: unknown;
      projectId?: unknown;
      images?: unknown;
    } | null;
    const prompt = typeof body?.prompt === "string" ? body.prompt : "";
    const projectId =
      typeof body?.projectId === "string" ? body.projectId : undefined;
    const images = parseChatImages(body?.images);
    if (!prompt.trim() && images.length === 0 && !projectId?.trim()) {
      throw new HttpError(400, "请输入对话内容");
    }
    const session = await createChatSession(user.id, prompt, projectId, images);
    return NextResponse.json({ session }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
