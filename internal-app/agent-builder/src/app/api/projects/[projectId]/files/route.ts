import { NextResponse } from "next/server";
import { requireApiUser } from "@/server/auth";
import { db } from "@/server/db";
import { handleApiError, HttpError } from "@/server/http";
import { searchMentionableEntries } from "@/server/mention-files";
import {
  ensureWorkspaceDir,
  listWorkspaceEntries,
  readWorkspaceFile,
  searchWorkspaceEntries,
} from "@/server/sandbox";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
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

    const url = new URL(request.url);
    const file = url.searchParams.get("file");
    if (file != null) {
      const content = await readWorkspaceFile(user.id, projectId, file);
      return NextResponse.json({ file: content });
    }

    if (url.searchParams.get("mention") === "1") {
      try {
        const root = await ensureWorkspaceDir(user.id, projectId);
        const entries = await searchMentionableEntries(
          root,
          url.searchParams.get("q") ?? ""
        );
        return NextResponse.json({ entries });
      } catch (error) {
        console.error("[mention files]", error);
        throw new HttpError(500, "读取项目文件失败");
      }
    }

    const query = url.searchParams.get("q");
    if (query != null && query.trim()) {
      const result = await searchWorkspaceEntries(user.id, projectId, query);
      return NextResponse.json(result);
    }

    const dir = url.searchParams.get("dir") ?? "";
    const entries = await listWorkspaceEntries(user.id, projectId, dir);
    return NextResponse.json({ entries });
  } catch (error) {
    return handleApiError(error);
  }
}
