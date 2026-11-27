import { NextResponse } from "next/server";
import { requireApiUser } from "@/server/auth";
import { db } from "@/server/db";
import { handleApiError, HttpError } from "@/server/http";
import {
  ensurePreviewProxy,
  parsePreviewUpstream,
} from "@/server/preview-proxy";
import { readPreviewServer } from "@/server/sandbox";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function ownedProject(userId: string, projectId: string) {
  const project = await db.project.findFirst({
    where: { id: projectId, userId },
    select: { id: true },
  });
  if (!project) throw new HttpError(404, "Project 不存在");
}

export async function GET(
  request: Request,
  context: { params: Promise<{ projectId: string }> }
) {
  try {
    const user = await requireApiUser();
    const { projectId } = await context.params;
    await ownedProject(user.id, projectId);
    const upstreamRaw = new URL(request.url).searchParams.get("upstream");
    if (!upstreamRaw) throw new HttpError(400, "请指定预览地址");
    const upstream = parsePreviewUpstream(upstreamRaw);
    if (!upstream) throw new HttpError(400, "预览地址无效");
    const status = await readPreviewServer(projectId);
    if (!status.running || !status.previewUrl) {
      throw new HttpError(400, "开发服务未运行");
    }
    const current = parsePreviewUpstream(status.previewUrl);
    if (!current || current.origin !== upstream.origin) {
      throw new HttpError(400, "预览地址无效");
    }
    const origin = await ensurePreviewProxy(
      upstream,
      request.headers.get("host") ?? ""
    );
    return NextResponse.json({ origin });
  } catch (error) {
    return handleApiError(error);
  }
}
