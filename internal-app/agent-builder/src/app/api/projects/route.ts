import { NextResponse } from "next/server";
import { requireApiUser } from "@/server/auth";
import { handleApiError, HttpError } from "@/server/http";
import { createProject, listProjects } from "@/server/sessions";

export async function GET() {
  try {
    const user = await requireApiUser();
    const projects = await listProjects(user.id);
    return NextResponse.json({ projects });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireApiUser();
    const body = (await request.json().catch(() => null)) as {
      name?: unknown;
      description?: unknown;
    } | null;
    if (!body || typeof body.name !== "string") {
      throw new HttpError(400, "请输入 Project 名称");
    }
    const description =
      typeof body.description === "string" ? body.description : undefined;
    const project = await createProject(user.id, body.name, description);
    return NextResponse.json({ project }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
