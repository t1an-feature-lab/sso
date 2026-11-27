import { NextResponse } from "next/server";
import { requireApiUser } from "@/server/auth";
import { db } from "@/server/db";
import { handleApiError, HttpError } from "@/server/http";
import { openTerminalSession } from "@/server/terminal-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 800;

async function ownedProject(userId: string, projectId: string) {
  const project = await db.project.findFirst({
    where: { id: projectId, userId },
    select: { id: true },
  });
  if (!project) throw new HttpError(404, "Project 不存在");
}

export async function POST(
  request: Request,
  context: { params: Promise<{ projectId: string }> }
) {
  try {
    const user = await requireApiUser();
    const { projectId } = await context.params;
    await ownedProject(user.id, projectId);
    const body = (await request.json().catch(() => null)) as {
      cols?: unknown;
      rows?: unknown;
    } | null;
    const sessionId = await openTerminalSession({
      userId: user.id,
      projectId,
      cols: typeof body?.cols === "number" ? body.cols : 80,
      rows: typeof body?.rows === "number" ? body.rows : 24,
    });
    return NextResponse.json({ sessionId });
  } catch (error) {
    return handleApiError(error);
  }
}
