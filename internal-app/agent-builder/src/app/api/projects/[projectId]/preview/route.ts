import { NextResponse } from "next/server";
import { requireApiUser } from "@/server/auth";
import { db } from "@/server/db";
import { handleApiError, HttpError } from "@/server/http";
import {
  readPreviewServer,
  startPreviewServer,
  stopPreviewServer,
} from "@/server/sandbox";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function ownedProject(userId: string, projectId: string) {
  const project = await db.project.findFirst({
    where: { id: projectId, userId },
    select: { id: true },
  });
  if (!project) throw new HttpError(404, "Project 不存在");
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ projectId: string }> }
) {
  try {
    const user = await requireApiUser();
    const { projectId } = await context.params;
    await ownedProject(user.id, projectId);
    return NextResponse.json(await readPreviewServer(projectId));
  } catch (error) {
    return handleApiError(error);
  }
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
      action?: unknown;
    } | null;
    const action = body?.action;
    if (action !== "start" && action !== "stop") {
      throw new HttpError(400, "请指定预览操作");
    }
    const status =
      action === "start"
        ? await startPreviewServer({
            userId: user.id,
            projectId,
            signal: request.signal,
          })
        : await stopPreviewServer({
            userId: user.id,
            projectId,
            signal: request.signal,
          });
    return NextResponse.json(status);
  } catch (error) {
    return handleApiError(error);
  }
}
