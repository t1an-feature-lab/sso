import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import {
  ToolLoopAgent,
  isStepCount,
  tool,
  type LanguageModel,
  type ModelMessage,
} from "ai";
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import type {
  ChatMessagePart,
  ChatSessionDetail,
  ChatStepPart,
  ChatToolPart,
  ChatToolStatus,
  ModelProvider,
  ModelProviderIconId,
} from "@/lib/types";
import { db } from "./db";
import { HttpError } from "./http";
import { getRunnableModel } from "./models";
import {
  ensureProjectContainer,
  executeProjectCommand,
  formatCommandResult,
  listProjectFiles,
} from "./sandbox";
import {
  imagePartsFromJson,
  readChatImage,
  saveChatImages,
  type ParsedChatImage,
} from "./message-images";
import { getChatSession } from "./sessions";

const shellTool = tool({
  description:
    "在当前 project 的 /workspace 中执行 shell 命令。开发服务器、watch 和不会自行退出的进程要把 background 设为 true，进程会继续留在容器里",
  inputSchema: z.object({
    command: z.string().describe("要执行的 shell 命令"),
    background: z
      .boolean()
      .optional()
      .describe("长驻进程设为 true，例如 pnpm dev、next dev、vite"),
  }),
  execute: async ({ command, background }) => {
    const context = currentRun();
    if (context.signal?.aborted) {
      throw new Error("已取消");
    }
    const result = await executeProjectCommand({
      userId: context.userId,
      projectId: context.projectId,
      command,
      background,
      signal: context.signal,
      onStatus: (message) => context.reportStatus(message),
    });
    if (context.signal?.aborted) {
      throw new Error("已取消");
    }
    context.lastPreviewUrl = result.previewUrl;
    return formatCommandResult(result);
  },
});

type RunContext = {
  userId: string;
  projectId: string;
  signal?: AbortSignal;
  onEvent: (event: string, data: unknown) => void;
  reportStatus: (message: string) => void;
  lastPreviewUrl: string | null;
};

const runStore = new AsyncLocalStorage<RunContext>();
const sessionRunTails = new Map<string, Promise<void>>();

function withSessionRun<T>(sessionId: string, task: () => Promise<T>): Promise<T> {
  const previous = sessionRunTails.get(sessionId) ?? Promise.resolve();
  let release: () => void = () => undefined;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const tail = previous.then(() => gate, () => gate);
  sessionRunTails.set(sessionId, tail);
  return previous
    .catch(() => undefined)
    .then(task)
    .finally(() => {
      release();
      if (sessionRunTails.get(sessionId) === tail) {
        sessionRunTails.delete(sessionId);
      }
    });
}

function currentRun(): RunContext {
  const context = runStore.getStore();
  if (!context) {
    throw new HttpError(500, "命令执行失败");
  }
  return context;
}

function languageModel(input: {
  provider: ModelProvider;
  modelName: string;
  baseUrl: string;
  apiKey: string;
}): LanguageModel {
  if (input.provider === "anthropic-messages") {
    const base = input.baseUrl.replace(/\/+$/, "");
    return createAnthropic({
      apiKey: input.apiKey,
      baseURL: base.endsWith("/v1") ? base : `${base}/v1`,
    })(input.modelName);
  }
  const openai = createOpenAI({
    apiKey: input.apiKey,
    baseURL: input.baseUrl,
  });
  if (input.provider === "openai-responses") {
    return openai.responses(input.modelName);
  }
  return openai.chat(input.modelName);
}

function commandFromInput(input: unknown): string {
  if (
    input &&
    typeof input === "object" &&
    "command" in input &&
    typeof input.command === "string"
  ) {
    return input.command;
  }
  return "shell";
}

function toolHistory(parts: ChatMessagePart[]): string {
  const tools = parts.filter((part): part is ChatToolPart => part.type === "tool");
  if (tools.length === 0) return "";
  const lines = tools.map((part) => {
    const exit =
      part.exitCode === null ? part.status : `${part.status} ${part.exitCode}`;
    return `- ${part.command} → ${exit}`;
  });
  return `\n\n命令记录:\n${lines.join("\n")}`;
}

function errorText(error: unknown): string {
  if (error instanceof HttpError) return error.message;
  if (error instanceof Error && error.message.trim()) return error.message;
  return "生成失败";
}

export function runSessionAgent(options: {
  userId: string;
  sessionId: string;
  modelId?: string | null;
  content?: string;
  images?: ParsedChatImage[];
  continueExisting?: boolean;
  signal?: AbortSignal;
  onEvent: (event: string, data: unknown) => void;
}): Promise<ChatSessionDetail> {
  return withSessionRun(options.sessionId, () => executeSessionAgent(options));
}

async function executeSessionAgent(options: {
  userId: string;
  sessionId: string;
  modelId?: string | null;
  content?: string;
  images?: ParsedChatImage[];
  continueExisting?: boolean;
  signal?: AbortSignal;
  onEvent: (event: string, data: unknown) => void;
}): Promise<ChatSessionDetail> {
  const existing = await db.chatSession.findFirst({
    where: { id: options.sessionId, userId: options.userId },
    include: {
      project: { select: { id: true, name: true } },
      messages: { orderBy: [{ createdAt: "asc" }] },
    },
  });
  if (!existing?.project) {
    throw new HttpError(404, "对话会话不存在");
  }
  const project = existing.project;

  const content = (options.content ?? "").trim();
  const images = options.images ?? [];
  if (!options.continueExisting) {
    if (!content && images.length === 0) throw new HttpError(400, "请输入消息内容");
    const storedContent = content || "请查看图片";
    const shouldRename =
      existing.messages.length === 0 && existing.title === "新会话";
    const message = await db.chatMessage.create({
      data: {
        sessionId: existing.id,
        role: "user",
        content: storedContent,
      },
    });
    const storedImages = await saveChatImages(message.id, images);
    if (storedImages.length > 0) {
      await db.chatMessage.update({
        where: { id: message.id },
        data: { parts: storedImages as unknown as Prisma.InputJsonValue },
      });
    }
    await db.chatSession.update({
      where: { id: existing.id },
      data: {
        ...(shouldRename
          ? {
              title:
                storedContent.length > 36
                  ? `${storedContent.slice(0, 36)}…`
                  : storedContent,
            }
          : {}),
        updatedAt: new Date(),
      },
    });
    await db.project.update({
      where: { id: project.id },
      data: { updatedAt: new Date() },
    });
  } else {
    const last = existing.messages.at(-1);
    if (!last || last.role !== "user") {
      throw new HttpError(400, "当前会话没有待处理的消息");
    }
  }

  const reloaded = await db.chatSession.findFirst({
    where: { id: existing.id },
    include: { messages: { orderBy: [{ createdAt: "asc" }] } },
  });
  if (!reloaded) throw new HttpError(404, "对话会话不存在");

  const steps: ChatStepPart[] = [];
  const context: RunContext = {
    userId: options.userId,
    projectId: project.id,
    signal: options.signal,
    onEvent: options.onEvent,
    reportStatus: () => undefined,
    lastPreviewUrl: null,
  };

  return runStore.run(context, async () => {
    let text = "";
    const tools: ChatToolPart[] = [];
    const timeline: ChatMessagePart[] = [];
    let saved = false;
    const appendText = (delta: string) => {
      if (!delta) return;
      text += delta;
      const last = timeline.at(-1);
      if (last?.type === "text") {
        last.text += delta;
        return;
      }
      timeline.push({ type: "text", text: delta });
    };
    const emitSteps = () => {
      options.onEvent("status", {
        steps: steps.map((step) => ({ ...step })),
      });
    };
    const settleSteps = (status: ChatToolStatus) => {
      const now = new Date().toISOString();
      let changed = false;
      for (const step of steps) {
        if (step.status !== "running") continue;
        step.status = status;
        step.endedAt = now;
        changed = true;
      }
      if (changed) emitSteps();
    };
    const settleOpenTools = () => {
      const now = new Date().toISOString();
      for (const item of tools) {
        if (item.status !== "running" || item.background) continue;
        item.status = "complete";
        item.endedAt = now;
        if (!item.output) item.output = "已取消";
        options.onEvent("tool", { tool: item });
      }
    };
    context.reportStatus = (message) => {
      if (message === "正在执行命令" || message === "正在后台启动命令") return;
      const now = new Date().toISOString();
      const running = steps.find((step) => step.status === "running");
      if (running?.label === message) return;
      if (running) {
        running.status = "complete";
        running.endedAt = now;
      }
      const step: ChatStepPart = {
        type: "step",
        id: `step-${steps.length + 1}`,
        label: message,
        status: "running",
        startedAt: now,
        endedAt: null,
      };
      steps.push(step);
      timeline.push(step);
      emitSteps();
    };
    let modelIcon: ModelProviderIconId = "openai";
    try {
      const modelConfig = await getRunnableModel(options.modelId);
      modelIcon = modelConfig.icon;
      await ensureProjectContainer(
        options.userId,
        project.id,
        (message) => context.reportStatus(message)
      );
      const files = await listProjectFiles(options.userId, project.id);
      options.onEvent("files", { files, previewUrl: null });

      const messages: ModelMessage[] = await Promise.all(
        reloaded.messages.map(async (message) => {
          const parts = parseStoredParts(message.parts);
          if (message.role === "assistant") {
            return {
              role: "assistant" as const,
              content: `${message.content}${toolHistory(parts)}`,
            };
          }
          const images = imagePartsFromJson(message.parts);
          const text = message.content.trim();
          if (images.length === 0) {
            return { role: "user" as const, content: text };
          }
          const attached = await Promise.all(
            images.map(async (image) => ({
              name: image.name,
              mediaType: image.mediaType,
              bytes: await readChatImage(message.id, image.id),
            }))
          );
          return {
            role: "user" as const,
            content: [
              { type: "text" as const, text: text || "请查看图片" },
              ...attached.map((image) => ({
                type: "file" as const,
                data: image.bytes,
                mediaType: image.mediaType,
                filename: image.name,
              })),
            ],
          };
        })
      );

      const agent = new ToolLoopAgent({
        model: languageModel(modelConfig),
        instructions: [
          `你是 Agent Builder 的编程助手，正在项目「${project.name}」中工作。`,
          "工作目录固定为 /workspace，只挂载了当前 project。",
          "使用 shell 工具查看、修改、安装和运行。不要假设仓库文件已经出现在对话里。",
          "pnpm dev、npm run dev、next dev、vite 以及其他不会自己退出的进程，必须把 background 设为 true。",
          "这类进程会留在容器内继续运行，日志在 .agent/procs/<id>.log，停止时 kill 对应 pid。",
          "预览只转发容器端口 3000、5173、4173、8080、8000，开发服务器优先监听 3000。",
          "用户消息可能附带图片，回答时依据图片内容。",
          "完成后用中文说明结果，不要把大段命令日志原样贴回。",
        ].join("\n"),
        tools: { shell: shellTool },
        stopWhen: isStepCount(24),
        toolCallConcurrency: 1,
      });

      context.reportStatus("正在思考");
      const result = await agent.stream({
        messages,
        abortSignal: options.signal,
      });

      for await (const part of result.fullStream) {
        if (options.signal?.aborted) break;
        if (part.type === "text-delta") {
          settleSteps("complete");
          appendText(part.text);
          options.onEvent("text", { delta: part.text });
        } else if (part.type === "tool-call") {
          settleSteps("complete");
          const toolPart: ChatToolPart = {
            type: "tool",
            id: part.toolCallId,
            command: commandFromInput(part.input),
            status: "running",
            output: "",
            exitCode: null,
            background: false,
            previewUrl: null,
            startedAt: new Date().toISOString(),
            endedAt: null,
          };
          tools.push(toolPart);
          timeline.push(toolPart);
          options.onEvent("tool", { tool: toolPart });
        } else if (part.type === "tool-result") {
          const output =
            typeof part.output === "string"
              ? part.output
              : JSON.stringify(part.output ?? "");
          const current = tools.find((item) => item.id === part.toolCallId);
          if (current) {
            current.status = output.startsWith("status: running")
              ? "running"
              : output.includes("\nstatus: error\n") ||
                  /^status: error/.test(output)
                ? "error"
                : "complete";
            current.output = output.slice(0, 8000);
            current.previewUrl = context.lastPreviewUrl;
            const exit = output.match(/^exitCode:\s*(-?\d+)/m);
            current.exitCode = exit ? Number(exit[1]) : null;
            current.background = output.startsWith("status: running");
            current.endedAt = new Date().toISOString();
            options.onEvent("tool", { tool: current });
          }
          const nextFiles = await listProjectFiles(
            options.userId,
            project.id
          );
          options.onEvent("files", {
            files: nextFiles,
            previewUrl: context.lastPreviewUrl,
          });
        } else if (part.type === "tool-error") {
          const current = tools.find((item) => item.id === part.toolCallId);
          if (options.signal?.aborted) {
            if (current && current.status === "running" && !current.background) {
              current.status = "complete";
              current.output = current.output || "已取消";
              current.endedAt = new Date().toISOString();
              options.onEvent("tool", { tool: current });
            }
            break;
          }
          const message = errorText(part.error);
          if (current) {
            current.status = "error";
            current.output = message;
            current.endedAt = new Date().toISOString();
            options.onEvent("tool", { tool: current });
          }
          if (part.error instanceof HttpError && part.error.status === 503) {
            throw part.error;
          }
        } else if (part.type === "error") {
          if (options.signal?.aborted) break;
          throw part.error;
        }
      }

      const aborted = Boolean(options.signal?.aborted);
      settleSteps("complete");
      if (aborted) settleOpenTools();
      if (aborted && !text.trim()) appendText("已取消");
      await saveAssistant(existing.id, project.id, text, timeline, modelIcon);
      saved = true;
    } catch (error) {
      const aborted = Boolean(options.signal?.aborted);
      settleSteps(aborted ? "complete" : "error");
      if (aborted) settleOpenTools();
      if (!saved) {
        if (aborted) {
          if (!text.trim()) appendText("已取消");
        } else {
          appendText(
            `${text.trim() ? "\n\n" : ""}生成失败：${errorText(error)}`
          );
        }
        if (
          text.trim() ||
          timeline.some((part) => part.type === "tool" || part.type === "step")
        ) {
          await saveAssistant(
            existing.id,
            project.id,
            text,
            timeline,
            modelIcon
          ).catch(() => undefined);
        }
      }
    }

    const session = await getChatSession(options.userId, existing.id);
    if (!session) throw new HttpError(404, "对话会话不存在");
    return session;
  });
}

function parseStoredParts(value: unknown): ChatMessagePart[] {
  if (!Array.isArray(value)) return [];
  return value.filter((part): part is ChatMessagePart => {
    if (!part || typeof part !== "object") return false;
    const record = part as { type?: string };
    return (
      record.type === "text" || record.type === "tool" || record.type === "step"
    );
  });
}

function snapshotTimeline(timeline: ChatMessagePart[]): ChatMessagePart[] {
  const parts: ChatMessagePart[] = [];
  for (const part of timeline) {
    if (part.type === "text") {
      const trimmed = part.text.trim();
      if (trimmed) parts.push({ type: "text", text: trimmed });
      continue;
    }
    parts.push({ ...part });
  }
  return parts;
}

async function saveAssistant(
  sessionId: string,
  projectId: string,
  text: string,
  timeline: ChatMessagePart[],
  modelIcon: ModelProviderIconId
): Promise<void> {
  const stored = snapshotTimeline(timeline);
  const content =
    text.trim() ||
    (stored.some((part) => part.type === "tool")
      ? "已执行命令"
      : stored.some((part) => part.type === "step")
        ? "已准备沙箱"
        : "已完成");
  const parts: Array<ChatMessagePart | { type: "model"; icon: ModelProviderIconId }> = [
    { type: "model", icon: modelIcon },
    ...stored,
  ];
  const now = new Date();
  await db.chatMessage.create({
    data: {
      sessionId,
      role: "assistant",
      content,
      parts: parts as unknown as Prisma.InputJsonValue,
    },
  });
  await db.chatSession.update({
    where: { id: sessionId },
    data: { updatedAt: now },
  });
  await db.project.update({
    where: { id: projectId },
    data: { updatedAt: now },
  });
}
