import { NextResponse } from "next/server";
import { requireApiUser } from "@/server/auth";
import { handleApiError, HttpError } from "@/server/http";
import { db } from "@/server/db";
import {
  executeProjectCommand,
  listProjectFiles,
} from "@/server/sandbox";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 800;

export async function POST(
  request: Request,
  context: { params: Promise<{ projectId: string }> }
) {
  try {
    const user = await requireApiUser();
    const { projectId } = await context.params;
    const project = await db.project.findFirst({
      where: { id: projectId, userId: user.id },
      select: { id: true },
    });
    if (!project) {
      throw new HttpError(404, "Project 不存在");
    }
    const body = (await request.json().catch(() => null)) as {
      command?: unknown;
      background?: unknown;
    } | null;
    if (!body || typeof body.command !== "string") {
      throw new HttpError(400, "请输入命令");
    }
    const result = await executeProjectCommand({
      userId: user.id,
      projectId,
      command: body.command,
      background: typeof body.background === "boolean" ? body.background : undefined,
      signal: request.signal,
    });
    const files = await listProjectFiles(user.id, projectId);
    return NextResponse.json({
      result,
      files,
      previewUrl: result.previewUrl,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
