import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import type {
  ChatMessageDto,
  ChatSessionDetail,
  ChatSessionSummary,
  ProjectFile,
  ProjectSummary,
} from "@/lib/types";
import { db } from "./db";
import { HttpError } from "./http";

const STARTER_PROJECTS: Array<{
  name: string;
  description: string;
  sessions: Array<{ title: string; prompt: string }>;
}> = [
  {
    name: "SSO 认证中心",
    description: "OAuth2 / OIDC 统一登录与权限管理工作空间",
    sessions: [
      {
        title: "JWT Token 刷新流程优化",
        prompt: "帮我排查并优化 authMiddleware 里的 JWT Token 静默刷新逻辑",
      },
      {
        title: "OIDC 回调与会话管理",
        prompt: "设计 OIDC 回调校验与多端会话撤销方案",
      },
    ],
  },
  {
    name: "营销落地页模板",
    description: "品牌官网与产品落地页快速构建工作空间",
    sessions: [
      {
        title: "SaaS 首页 Hero 与定价区",
        prompt: "生成一个简洁现代的 SaaS 产品首页，包含 Hero 区块与三档定价卡片",
      },
      {
        title: "暗色主题与响应式适配",
        prompt: "为落地页补充亮暗色切换与移动端自适应布局",
      },
    ],
  },
  {
    name: "数据看板应用",
    description: "实时指标监控与可视化分析工作空间",
    sessions: [
      {
        title: "核心 KPI 卡片与趋势图",
        prompt: "搭建运营数据看板首页，包含核心指标卡片与近 30 天趋势图",
      },
      {
        title: "筛选器与数据导出交互",
        prompt: "为数据看板添加时间范围筛选、多维过滤和 CSV 导出交互",
      },
    ],
  },
];

const starterSeedInFlight = new Map<string, Promise<void>>();

function buildStarterFiles(title: string, prompt: string): ProjectFile[] {
  const safeTitle = title.replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const safePrompt = prompt.replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const indexHtml = `<!DOCTYPE html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${safeTitle}</title>
    <link rel="stylesheet" href="styles.css" />
  </head>
  <body>
    <main class="shell">
      <header class="hero">
        <span class="badge">Agent Builder Preview</span>
        <h1>${safeTitle}</h1>
        <p>${safePrompt}</p>
        <div class="actions">
          <button id="primaryAction" class="btn primary">开始体验</button>
          <button id="counterAction" class="btn secondary">点击计数：<span id="count">0</span></button>
        </div>
      </header>
      <section class="grid">
        <article class="card">
          <h3>实时代码编辑</h3>
          <p>在右侧切换「代码」与「预览」标签，随时查看项目文件结构和渲染效果</p>
        </article>
        <article class="card">
          <h3>持续对话迭代</h3>
          <p>在左侧继续发送指令，Agent 会同步更新当前会话的代码产物与预览画面</p>
        </article>
      </section>
    </main>
    <script src="app.js"></script>
  </body>
</html>`;

  const stylesCss = `:root {
  color-scheme: light dark;
  --bg: #f8fafc;
  --surface: #ffffff;
  --text: #0f172a;
  --muted: #475569;
  --border: #e2e8f0;
  --accent: #171717;
  --on-accent: #ffffff;
}

@media (prefers-color-scheme: dark) {
  :root {
    --bg: #0f1117;
    --surface: #171a22;
    --text: #f8fafc;
    --muted: #94a3b8;
    --border: #262b38;
    --accent: #f8fafc;
    --on-accent: #0f1117;
  }
}

* { box-sizing: border-box; margin: 0; padding: 0; }

body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  background: var(--bg);
  color: var(--text);
  min-height: 100vh;
  padding: 32px 24px;
}

.shell {
  max-width: 780px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.hero {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 16px;
  padding: 28px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.badge {
  align-self: flex-start;
  font-size: 12px;
  font-weight: 600;
  color: var(--accent);
  background: color-mix(in srgb, var(--accent) 12%, transparent);
  padding: 4px 10px;
  border-radius: 999px;
}

.hero h1 { font-size: 26px; line-height: 1.3; }
.hero p { color: var(--muted); line-height: 1.6; font-size: 14px; }

.actions { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 6px; }

.btn {
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 9px 16px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
}

.btn.primary {
  background: var(--accent);
  border-color: var(--accent);
  color: var(--on-accent);
}

.btn.secondary {
  background: transparent;
  color: var(--text);
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 16px;
}

.card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 14px;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.card h3 { font-size: 15px; }
.card p { font-size: 13px; color: var(--muted); line-height: 1.6; }`;

  const appJs = `let count = 0;
const countEl = document.getElementById("count");
const counterBtn = document.getElementById("counterAction");
const primaryBtn = document.getElementById("primaryAction");

if (counterBtn && countEl) {
  counterBtn.addEventListener("click", () => {
    count += 1;
    countEl.textContent = String(count);
  });
}

if (primaryBtn) {
  primaryBtn.addEventListener("click", () => {
    primaryBtn.textContent = "已就绪";
  });
}`;

  const configJson = JSON.stringify(
    {
      name: "agent-builder-app",
      version: "0.1.0",
      entry: "index.html",
      updatedAt: new Date().toISOString(),
    },
    null,
    2
  );

  return [
    { path: "src/index.html", language: "html", content: indexHtml },
    { path: "src/styles.css", language: "css", content: stylesCss },
    { path: "src/app.js", language: "javascript", content: appJs },
    { path: "project.json", language: "json", content: configJson },
  ];
}

function parseFiles(raw: Prisma.JsonValue): ProjectFile[] {
  if (!Array.isArray(raw)) return [];
  const result: ProjectFile[] = [];
  for (const item of raw) {
    if (
      typeof item === "object" &&
      item !== null &&
      !Array.isArray(item) &&
      typeof item.path === "string" &&
      typeof item.language === "string" &&
      typeof item.content === "string"
    ) {
      result.push({
        path: item.path,
        language: item.language,
        content: item.content,
      });
    }
  }
  return result;
}

function toMessageDto(m: {
  id: string;
  sessionId: string;
  role: string;
  content: string;
  artifactTitle: string | null;
  createdAt: Date;
}): ChatMessageDto {
  return {
    id: m.id,
    sessionId: m.sessionId,
    role: m.role === "assistant" ? "assistant" : "user",
    content: m.content,
    artifactTitle: m.artifactTitle,
    createdAt: m.createdAt.toISOString(),
  };
}

function deriveTitle(prompt: string): string {
  const cleaned = prompt.trim().replace(/\s+/g, " ");
  if (!cleaned) return "新建对话";
  return cleaned.length > 36 ? `${cleaned.slice(0, 36)}…` : cleaned;
}

export async function ensureStarterProjects(userId: string): Promise<void> {
  const existingTask = starterSeedInFlight.get(userId);
  if (existingTask) {
    return existingTask;
  }

  const task = (async () => {
    const existingProjects = await db.project.findMany({
      where: { userId },
      orderBy: [{ updatedAt: "desc" }],
      select: { id: true },
      take: 1,
    });

    if (existingProjects.length > 0) {
      await db.chatSession.updateMany({
        where: { userId, projectId: null },
        data: { projectId: existingProjects[0].id },
      });
      return;
    }

    const baseTime = Date.now();
    const createdProjectIds: string[] = [];

    for (let pIndex = 0; pIndex < STARTER_PROJECTS.length; pIndex += 1) {
      const starter = STARTER_PROJECTS[pIndex];
      const projectUpdatedAt = new Date(baseTime - pIndex * 60_000);
      const createdProject = await db.project.create({
        data: {
          userId,
          name: starter.name,
          description: starter.description,
          createdAt: projectUpdatedAt,
          updatedAt: projectUpdatedAt,
        },
        select: { id: true },
      });
      createdProjectIds.push(createdProject.id);

      for (let sIndex = 0; sIndex < starter.sessions.length; sIndex += 1) {
        const s = starter.sessions[sIndex];
        const sessionTime = new Date(
          projectUpdatedAt.getTime() - sIndex * 10_000
        );
        const files = buildStarterFiles(s.title, s.prompt);
        await db.chatSession.create({
          data: {
            userId,
            projectId: createdProject.id,
            title: s.title,
            files: files as unknown as Prisma.InputJsonValue,
            createdAt: sessionTime,
            updatedAt: sessionTime,
            messages: {
              create: [
                {
                  role: "user",
                  content: s.prompt,
                  createdAt: sessionTime,
                },
                {
                  role: "assistant",
                  content: `已根据你的需求「${s.title}」初始化工作空间代码与预览页面\n\n我生成了以下文件：\n- \`src/index.html\`：页面主结构与交互区域\n- \`src/styles.css\`：自适应亮暗色主题样式\n- \`src/app.js\`：前端交互脚本\n- \`project.json\`：项目配置清单`,
                  artifactTitle: s.title,
                  createdAt: new Date(sessionTime.getTime() + 1_000),
                },
              ],
            },
          },
        });
      }
    }

    if (createdProjectIds.length > 0) {
      await db.chatSession.updateMany({
        where: { userId, projectId: null },
        data: { projectId: createdProjectIds[0] },
      });
    }
  })().finally(() => {
    starterSeedInFlight.delete(userId);
  });

  starterSeedInFlight.set(userId, task);
  return task;
}

export async function listProjects(userId: string): Promise<ProjectSummary[]> {
  await ensureStarterProjects(userId);

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
  const deleted = await db.project.deleteMany({
    where: { id: projectId, userId },
  });
  if (deleted.count === 0) {
    throw new HttpError(404, "Project 不存在");
  }
}

export async function listChatSessions(
  userId: string
): Promise<ChatSessionSummary[]> {
  await ensureStarterProjects(userId);

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
    files: parseFiles(row.files),
    messages: row.messages.map(toMessageDto),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function createChatSession(
  userId: string,
  rawPrompt?: string,
  rawProjectId?: string
): Promise<ChatSessionDetail> {
  const prompt = (rawPrompt ?? "").trim();
  const trimmedProjectId = rawProjectId?.trim();
  if (!prompt && !trimmedProjectId) {
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
    await ensureStarterProjects(userId);
    targetProject = await db.project.findFirst({
      where: { userId },
      orderBy: [{ updatedAt: "desc" }],
      select: { id: true, name: true, description: true },
    });
    if (!targetProject) {
      targetProject = await db.project.create({
        data: { userId, name: "默认工作空间" },
        select: { id: true, name: true, description: true },
      });
    }
  }

  const isBlankSession = !prompt;
  const title = isBlankSession ? "新会话" : deriveTitle(prompt);
  const files = isBlankSession ? [] : buildStarterFiles(title, prompt);

  const created = await db.chatSession.create({
    data: {
      userId,
      projectId: targetProject.id,
      title,
      files: files as unknown as Prisma.InputJsonValue,
      ...(isBlankSession
        ? {}
        : {
            messages: {
              create: [
                {
                  role: "user",
                  content: prompt,
                },
                {
                  role: "assistant",
                  content: `已根据你的需求「${title}」初始化项目代码与预览页面\n\n我生成了以下文件：\n- \`src/index.html\`：页面主结构与交互区域\n- \`src/styles.css\`：自适应亮暗色主题样式\n- \`src/app.js\`：前端交互脚本\n- \`project.json\`：项目配置清单\n\n你可以在右侧面板中切换「代码」和「预览」查看效果，或继续告诉我需要调整的细节`,
                  artifactTitle: title,
                },
              ],
            },
          }),
    },
    include: {
      messages: {
        orderBy: [{ createdAt: "asc" }],
      },
    },
  });

  await db.project.update({
    where: { id: targetProject.id },
    data: { updatedAt: new Date() },
  });

  return {
    id: created.id,
    projectId: targetProject.id,
    projectName: targetProject.name,
    title: created.title,
    files,
    messages: created.messages.map(toMessageDto),
    createdAt: created.createdAt.toISOString(),
    updatedAt: created.updatedAt.toISOString(),
  };
}

export async function appendChatMessage(
  userId: string,
  sessionId: string,
  rawContent: string
): Promise<ChatSessionDetail> {
  const content = rawContent.trim();
  if (!content) {
    throw new HttpError(400, "请输入消息内容");
  }

  const existing = await db.chatSession.findFirst({
    where: { id: sessionId, userId },
    include: {
      _count: {
        select: { messages: true },
      },
    },
  });
  if (!existing) {
    throw new HttpError(404, "对话会话不存在");
  }

  const shouldRenameFromFirstMessage =
    existing._count.messages === 0 && existing.title === "新会话";
  const nextTitle = shouldRenameFromFirstMessage
    ? deriveTitle(content)
    : existing.title;

  const currentFiles = parseFiles(existing.files);
  const safeNote = content.replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const updatedFiles =
    currentFiles.length === 0
      ? buildStarterFiles(nextTitle, content)
      : currentFiles.map((file) => {
          if (
            file.path === "src/index.html" &&
            file.content.includes("</section>")
          ) {
            return {
              ...file,
              content: file.content.replace(
                "</section>",
                `        <article class="card">\n          <h3>最新迭代</h3>\n          <p>${safeNote}</p>\n        </article>\n      </section>`
              ),
            };
          }
          return file;
        });

  const now = new Date();
  await db.$transaction([
    db.chatMessage.create({
      data: {
        sessionId,
        role: "user",
        content,
      },
    }),
    db.chatMessage.create({
      data: {
        sessionId,
        role: "assistant",
        content: `已根据你的补充要求更新了 \`src/index.html\` 并同步刷新了右侧预览\n\n本次变更摘要：\n- 响应需求：「${deriveTitle(content)}」\n- 已更新项目代码并在右侧「预览」面板生效`,
        artifactTitle: nextTitle,
      },
    }),
    db.chatSession.update({
      where: { id: sessionId },
      data: {
        ...(shouldRenameFromFirstMessage ? { title: nextTitle } : {}),
        files: updatedFiles as unknown as Prisma.InputJsonValue,
        updatedAt: now,
      },
    }),
    ...(existing.projectId
      ? [
          db.project.update({
            where: { id: existing.projectId },
            data: { updatedAt: now },
          }),
        ]
      : []),
  ]);

  const refreshed = await getChatSession(userId, sessionId);
  if (!refreshed) {
    throw new HttpError(404, "对话会话不存在");
  }
  return refreshed;
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
  const deleted = await db.chatSession.deleteMany({
    where: { id: sessionId, userId },
  });
  if (deleted.count === 0) {
    throw new HttpError(404, "对话会话不存在");
  }
}
