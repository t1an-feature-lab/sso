import { NextResponse } from "next/server";
import { requireApiUser } from "@/server/auth";
import { handleApiError, HttpError } from "@/server/http";
import { deleteProject, updateProject } from "@/server/sessions";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ projectId: string }> }
) {
  try {
    const user = await requireApiUser();
    const { projectId } = await context.params;
    const body = (await request.json().catch(() => null)) as {
      name?: unknown;
      description?: unknown;
    } | null;
    if (!body || typeof body.name !== "string") {
      throw new HttpError(400, "请输入 Project 名称");
    }
    const description =
      typeof body.description === "string" ? body.description : undefined;
    const project = await updateProject(
      user.id,
      projectId,
      body.name,
      description
    );
    return NextResponse.json({ project });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ projectId: string }> }
) {
  try {
    const user = await requireApiUser();
    const { projectId } = await context.params;
    await deleteProject(user.id, projectId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
