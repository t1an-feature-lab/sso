import { NextResponse } from "next/server";
import { requireApiUser } from "@/server/auth";
import { handleApiError, HttpError } from "@/server/http";
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
    } | null;
    const prompt = typeof body?.prompt === "string" ? body.prompt : "";
    const projectId =
      typeof body?.projectId === "string" ? body.projectId : undefined;
    if (!prompt.trim() && !projectId?.trim()) {
      throw new HttpError(400, "请输入对话内容");
    }
    const session = await createChatSession(user.id, prompt, projectId);
    return NextResponse.json({ session }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
