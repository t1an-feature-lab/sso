import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import {
  isModelProviderIcon,
  type ChatMessageDto,
  type ChatMessagePart,
  type ChatSessionDetail,
  type ChatSessionSummary,
  type ModelProviderIconId,
  type ProjectSummary,
} from "@/lib/types";
import { db } from "./db";
import { HttpError } from "./http";
import {
  deleteChatImages,
  imagePartsFromJson,
  saveChatImages,
  toChatImagePart,
  type ParsedChatImage,
} from "./message-images";
import {
  destroyProjectSandbox,
  ensureWorkspaceDir,
  listProjectFiles,
  readPreviewUrl,
} from "./sandbox";

const MOCK_PROJECT_NAMES = ["SSO 认证中心", "营销落地页模板", "数据看板应用"];
const MOCK_ASSISTANT_PREFIX = "已根据你的需求";
const purgeTasks = new Map<string, Promise<void>>();

function parseParts(
  value: Prisma.JsonValue,
  message: { id: string; sessionId: string }
): {
  parts: ChatMessagePart[];
  modelIcon: ModelProviderIconId | null;
} {
  if (!Array.isArray(value)) return { parts: [], modelIcon: null };
  const parts: ChatMessagePart[] = [];
  let modelIcon: ModelProviderIconId | null = null;
  for (const image of imagePartsFromJson(value)) {
    parts.push(toChatImagePart(image, message.sessionId, message.id));
  }
  for (const item of value) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const record = item as Record<string, Prisma.JsonValue>;
    if (record.type === "model" && isModelProviderIcon(record.icon)) {
      modelIcon = record.icon;
      continue;
    }
    if (record.type === "text" && typeof record.text === "string") {
      parts.push({ type: "text", text: record.text });
      continue;
    }
    if (record.type === "tool" && typeof record.command === "string") {
      const status =
        record.status === "running" || record.status === "error"
          ? record.status
          : "complete";
      parts.push({
        type: "tool",
        id: typeof record.id === "string" ? record.id : record.command,
        command: record.command,
        status,
        output: typeof record.output === "string" ? record.output : "",
        exitCode: typeof record.exitCode === "number" ? record.exitCode : null,
        background: record.background === true,
        previewUrl:
          typeof record.previewUrl === "string" ? record.previewUrl : null,
        startedAt:
          typeof record.startedAt === "string" ? record.startedAt : undefined,
        endedAt:
          typeof record.endedAt === "string" || record.endedAt === null
            ? (record.endedAt as string | null)
            : undefined,
      });
      continue;
    }
    if (record.type === "step" && typeof record.label === "string") {
      const status =
        record.status === "running" || record.status === "error"
          ? record.status
          : "complete";
      parts.push({
        type: "step",
        id: typeof record.id === "string" ? record.id : record.label,
        label: record.label,
        status,
        startedAt:
          typeof record.startedAt === "string"
            ? record.startedAt
            : new Date(0).toISOString(),
        endedAt: typeof record.endedAt === "string" ? record.endedAt : null,
      });
    }
  }
  return { parts, modelIcon };
}

function toMessageDto(m: {
  id: string;
  sessionId: string;
  role: string;
  content: string;
  parts: Prisma.JsonValue;
  artifactTitle: string | null;
  createdAt: Date;
}): ChatMessageDto {
  const parsed = parseParts(m.parts, { id: m.id, sessionId: m.sessionId });
  return {
    id: m.id,
    sessionId: m.sessionId,
    role: m.role === "assistant" ? "assistant" : "user",
    content: m.content,
    parts: parsed.parts,
    modelIcon: m.role === "assistant" ? parsed.modelIcon : null,
    artifactTitle: m.artifactTitle,
    createdAt: m.createdAt.toISOString(),
  };
}

function purgeMockData(userId: string): Promise<void> {
  const existing = purgeTasks.get(userId);
  if (existing) return existing;
  const task = purgeMockDataNow(userId).catch((error) => {
    purgeTasks.delete(userId);
    throw error;
  });
  purgeTasks.set(userId, task);
  return task;
}

async function purgeMockDataNow(userId: string): Promise<void> {
  const sessions = await db.chatSession.findMany({
      where: { userId },
      select: {
        id: true,
        messages: { select: { role: true, content: true } },
      },
    });
    const mockIds = sessions
      .filter((session) => {
        const assistants = session.messages.filter(
          (message) => message.role === "assistant"
        );
        return (
          assistants.length > 0 &&
          assistants.every((message) =>
            message.content.startsWith(MOCK_ASSISTANT_PREFIX)
          )
        );
      })
      .map((session) => session.id);
    if (mockIds.length > 0) {
      await db.chatSession.deleteMany({
        where: { userId, id: { in: mockIds } },
      });
    }
    await db.project.deleteMany({
      where: {
        userId,
        name: { in: MOCK_PROJECT_NAMES },
        sessions: { none: {} },
      },
    });
}

function deriveTitle(prompt: string): string {
  const cleaned = prompt.trim().replace(/\s+/g, " ");
  if (!cleaned) return "新建对话";
  return cleaned.length > 36 ? `${cleaned.slice(0, 36)}…` : cleaned;
}

export async function listProjects(userId: string): Promise<ProjectSummary[]> {
  await purgeMockData(userId);

  const rows = await db.project.findMany({
    where: { userId },
    orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
    include: {
      sessions: {
        orderBy: [{ updatedAt: "desc" }],
        select: {
          id: true,
          projectId: true,
          title: true,
          createdAt: true,
          updatedAt: true,
        },
      },
    },
  });

  return rows.map((project) => ({
    id: project.id,
    name: project.name,
    description: project.description,
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString(),
    sessions: project.sessions.map((session) => ({
      id: session.id,
      projectId: session.projectId,
      title: session.title,
      createdAt: session.createdAt.toISOString(),
      updatedAt: session.updatedAt.toISOString(),
    })),
  }));
}

export async function createProject(
  userId: string,
  rawName: string,
  rawDescription?: string
): Promise<ProjectSummary> {
  const name = rawName.trim();
  if (!name) {
    throw new HttpError(400, "请输入 Project 名称");
  }
  if (name.length > 120) {
    throw new HttpError(400, "Project 名称不能超过 120 个字符");
  }
  const description = rawDescription?.trim() || null;
  if (description && description.length > 300) {
    throw new HttpError(400, "Project 描述不能超过 300 个字符");
  }

  const created = await db.project.create({
    data: {
      userId,
      name,
      description,
    },
  });
  await ensureWorkspaceDir(userId, created.id);

  return {
    id: created.id,
    name: created.name,
    description: created.description,
    createdAt: created.createdAt.toISOString(),
    updatedAt: created.updatedAt.toISOString(),
    sessions: [],
  };
}

export async function updateProject(
  userId: string,
  projectId: string,
  rawName: string,
  rawDescription?: string
): Promise<ProjectSummary> {
  const name = rawName.trim();
  if (!name) {
    throw new HttpError(400, "请输入 Project 名称");
  }
  if (name.length > 120) {
    throw new HttpError(400, "Project 名称不能超过 120 个字符");
  }
  const description =
    rawDescription === undefined ? undefined : rawDescription.trim() || null;
  if (description && description.length > 300) {
    throw new HttpError(400, "Project 描述不能超过 300 个字符");
  }

  const existing = await db.project.findFirst({
    where: { id: projectId, userId },
    select: { id: true },
  });
  if (!existing) {
    throw new HttpError(404, "Project 不存在");
  }

  const updated = await db.project.update({
    where: { id: projectId },
    data: {
      name,
      ...(description !== undefined ? { description } : {}),
    },
    include: {
      sessions: {
        orderBy: [{ updatedAt: "desc" }],
        select: {
          id: true,
          projectId: true,
          title: true,
          createdAt: true,
          updatedAt: true,
        },
      },
    },
  });

  return {
    id: updated.id,
    name: updated.name,
    description: updated.description,
    createdAt: updated.createdAt.toISOString(),
    updatedAt: updated.updatedAt.toISOString(),
    sessions: updated.sessions.map((session) => ({
      id: session.id,
      projectId: session.projectId,
      title: session.title,
      createdAt: session.createdAt.toISOString(),
      updatedAt: session.updatedAt.toISOString(),
    })),
  };
}

export async function deleteProject(
  userId: string,
  projectId: string
): Promise<void> {
  const existing = await db.project.findFirst({
    where: { id: projectId, userId },
    select: { id: true },
  });
  if (!existing) {
    throw new HttpError(404, "Project 不存在");
  }
  await destroyProjectSandbox(userId, projectId);
  await db.project.deleteMany({
    where: { id: projectId, userId },
  });
}

export async function listChatSessions(
  userId: string
): Promise<ChatSessionSummary[]> {
  await purgeMockData(userId);

  const rows = await db.chatSession.findMany({
    where: { userId },
    orderBy: [{ updatedAt: "desc" }],
    select: {
      id: true,
      projectId: true,
      title: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  return rows.map((row) => ({
    id: row.id,
    projectId: row.projectId,
    title: row.title,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }));
}

export async function getChatSession(
  userId: string,
  sessionId: string
): Promise<ChatSessionDetail | null> {
  await purgeMockData(userId);
  const row = await db.chatSession.findFirst({
    where: { id: sessionId, userId },
    include: {
      project: {
        select: { id: true, name: true },
      },
      messages: {
        orderBy: [{ createdAt: "asc" }],
      },
    },
  });
  if (!row) return null;
  return {
    id: row.id,
    projectId: row.projectId,
    projectName: row.project?.name ?? null,
    title: row.title,
    files: row.projectId
      ? await listProjectFiles(userId, row.projectId)
      : [],
    previewUrl: row.projectId ? await readPreviewUrl(row.projectId) : null,
    messages: row.messages.map(toMessageDto),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function createChatSession(
  userId: string,
  rawPrompt?: string,
  rawProjectId?: string,
  images: ParsedChatImage[] = []
): Promise<ChatSessionDetail> {
  const prompt = (rawPrompt ?? "").trim();
  const trimmedProjectId = rawProjectId?.trim();
  if (!prompt && images.length === 0 && !trimmedProjectId) {
    throw new HttpError(400, "请输入对话内容");
  }

  let targetProject: { id: string; name: string; description: string | null } | null =
    null;
  if (trimmedProjectId) {
    targetProject = await db.project.findFirst({
      where: { id: trimmedProjectId, userId },
      select: { id: true, name: true, description: true },
    });
    if (!targetProject) {
      throw new HttpError(404, "所选 Project 不存在");
    }
  } else {
    targetProject = await db.project.findFirst({
      where: { userId },
      orderBy: [{ updatedAt: "desc" }],
      select: { id: true, name: true, description: true },
    });
    if (!targetProject) {
      throw new HttpError(400, "请先创建 Project");
    }
  }

  const isBlankSession = !prompt && images.length === 0;
  const title = isBlankSession ? "新会话" : deriveTitle(prompt || "图片");
  await ensureWorkspaceDir(userId, targetProject.id);

  const created = await db.chatSession.create({
    data: {
      userId,
      projectId: targetProject.id,
      title,
      files: [],
    },
  });

  if (!isBlankSession) {
    const message = await db.chatMessage.create({
      data: {
        sessionId: created.id,
        role: "user",
        content: prompt || "请查看图片",
      },
    });
    const stored = await saveChatImages(message.id, images);
    if (stored.length > 0) {
      await db.chatMessage.update({
        where: { id: message.id },
        data: { parts: stored as unknown as Prisma.InputJsonValue },
      });
    }
  }

  await db.project.update({
    where: { id: targetProject.id },
    data: { updatedAt: new Date() },
  });

  const session = await getChatSession(userId, created.id);
  if (!session) {
    throw new HttpError(500, "创建对话失败");
  }
  return session;
}

export async function renameChatSession(
  userId: string,
  sessionId: string,
  rawTitle: string
): Promise<ChatSessionSummary> {
  const title = rawTitle.trim();
  if (!title) {
    throw new HttpError(400, "请输入会话名称");
  }
  if (title.length > 200) {
    throw new HttpError(400, "会话名称不能超过 200 个字符");
  }

  const existing = await db.chatSession.findFirst({
    where: { id: sessionId, userId },
    select: { id: true },
  });
  if (!existing) {
    throw new HttpError(404, "对话会话不存在");
  }

  const updated = await db.chatSession.update({
    where: { id: sessionId },
    data: { title },
    select: {
      id: true,
      projectId: true,
      title: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return {
    id: updated.id,
    projectId: updated.projectId,
    title: updated.title,
    createdAt: updated.createdAt.toISOString(),
    updatedAt: updated.updatedAt.toISOString(),
  };
}

export async function deleteChatSession(
  userId: string,
  sessionId: string
): Promise<void> {
  const messages = await db.chatMessage.findMany({
    where: { sessionId, session: { userId } },
    select: { id: true },
  });
  const deleted = await db.chatSession.deleteMany({
    where: { id: sessionId, userId },
  });
  if (deleted.count === 0) {
    throw new HttpError(404, "对话会话不存在");
  }
  await Promise.all(messages.map((message) => deleteChatImages(message.id)));
}
