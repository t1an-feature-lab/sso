"use client";

import {
  Fragment,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import {
  HStack,
  VStack,
  Layout,
  LayoutContent,
} from "@astryxdesign/core/Layout";
import { Text } from "@astryxdesign/core/Text";
import { Toolbar } from "@astryxdesign/core/Toolbar";
import {
  ChatLayout,
  ChatLayoutScrollButton,
  ChatMessage,
  ChatMessageBubble,
  ChatMessageList,
  ChatMessageMetadata,
  ChatToolCalls,
} from "@astryxdesign/core/Chat";
import { Banner } from "@astryxdesign/core/Banner";
import { Card } from "@astryxdesign/core/Card";
import { Markdown } from "@astryxdesign/core/Markdown";
import { CodeBlock } from "@astryxdesign/core/CodeBlock";
import { Timestamp } from "@astryxdesign/core/Timestamp";
import { Button } from "@astryxdesign/core/Button";
import { Divider } from "@astryxdesign/core/Divider";
import { EmptyState } from "@astryxdesign/core/EmptyState";
import { Icon } from "@astryxdesign/core/Icon";
import { Spinner } from "@astryxdesign/core/Spinner";
import { CheckIndicator } from "@astryxdesign/core/Indicator";
import { Dialog, DialogHeader } from "@astryxdesign/core/Dialog";
import { Popover } from "@astryxdesign/core/Popover";
import { useResizable, ResizeHandle } from "@astryxdesign/core/Resizable";
import { useClipboard } from "@astryxdesign/core/hooks";
import { VisuallyHidden } from "@astryxdesign/core/VisuallyHidden";
import {
  ArrowLeftIcon,
  PencilSquareIcon,
  PlusIcon,
  ViewColumnsIcon,
} from "@heroicons/react/24/outline";
import { AgentChatComposer } from "@/components/agent-chat-composer";
import { ModelProviderIcon } from "@/components/model-provider-icon";
import { useAppToast } from "@/components/app-toast";
import {
  IdePreviewPanel,
  type PersistedWorkspaceTabs,
} from "@/components/ide-preview-panel";
import {
  ProjectFormDialog,
  type ProjectFormValues,
} from "@/components/project-form-dialog";
import { SessionRenameDialog } from "@/components/session-rename-dialog";
import { apiClient } from "@/lib/api-client";
import {
  CHAT_PANEL_DEFAULT_WIDTH,
  CHAT_PANEL_MAX_WIDTH,
  CHAT_PANEL_MIN_WIDTH,
  CHAT_SCROLL_CONTAINER_ID,
  readChatPanelWidthFromDocument,
  writeChatPanelWidthCookie,
} from "@/lib/chat-panel-prefs";
import type {
  AvailableModelOption,
  ChatMessagePart,
  ChatSessionDetail,
  ChatStepPart,
  ChatToolPart,
  ModelProviderIconId,
  ProjectFile,
  ProjectSummary,
} from "@/lib/types";
import "./chat-session-view.css";

const MOBILE_MAX_WIDTH = 767;

const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

const rootStyle: CSSProperties = {
  height: "100dvh",
  width: "100%",
  backgroundColor: "var(--color-background-surface)",
  containerType: "inline-size",
  containerName: "workspace",
};

const chatLayoutStyle: CSSProperties = {
  flex: 1,
  minHeight: 0,
};

const chatPanelWidthVar = (size: number | string): CSSProperties =>
  ({
    "--chat-panel-width": typeof size === "number" ? `${size}px` : size,
  }) as CSSProperties;

type LiveDraft = {
  parts: ChatMessagePart[];
  icon: ModelProviderIconId;
};

type QueuedTurn = {
  id: string;
  content: string;
  modelId: string | null;
};

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

function formatDuration(
  startedAt?: string,
  endedAt?: string | null
): string | undefined {
  if (!startedAt || !endedAt) return undefined;
  const ms = Date.parse(endedAt) - Date.parse(startedAt);
  if (!Number.isFinite(ms) || ms < 0) return undefined;
  if (ms < 1000) return `${Math.max(ms, 1)}ms`;
  const seconds = ms / 1000;
  if (seconds < 60) {
    return seconds >= 10 ? `${Math.round(seconds)}s` : `${seconds.toFixed(1)}s`;
  }
  const minutes = Math.floor(seconds / 60);
  const rest = Math.round(seconds % 60);
  return rest > 0 ? `${minutes}m ${rest}s` : `${minutes}m`;
}

function commandLabel(command: string): string {
  return command.replace(/\s+/g, " ").trim();
}

function commandBody(output: string): string {
  const marker = output.indexOf("\n---\n");
  return (marker >= 0 ? output.slice(marker + 5) : output).trim().slice(0, 4000);
}

function stepTarget(step: ChatStepPart): string {
  if (step.status !== "complete") return step.label;
  return step.label.replace(/^正在/, "已");
}

function withText(parts: ChatMessagePart[], delta: string): ChatMessagePart[] {
  if (!delta) return parts;
  const last = parts.at(-1);
  if (last?.type === "text") {
    return [...parts.slice(0, -1), { type: "text", text: last.text + delta }];
  }
  return [...parts, { type: "text", text: delta }];
}

function withTool(
  parts: ChatMessagePart[],
  toolPart: ChatToolPart
): ChatMessagePart[] {
  const index = parts.findIndex(
    (part) => part.type === "tool" && part.id === toolPart.id
  );
  if (index < 0) return [...parts, toolPart];
  const next = parts.slice();
  next[index] = toolPart;
  return next;
}

function withSteps(
  parts: ChatMessagePart[],
  steps: ChatStepPart[]
): ChatMessagePart[] {
  const next = parts.slice();
  for (const step of steps) {
    const index = next.findIndex(
      (part) => part.type === "step" && part.id === step.id
    );
    if (index >= 0) next[index] = step;
    else next.push(step);
  }
  return next;
}

type ActivityCall = {
  key: string;
  name: string;
  target: string;
  node?: string;
  status: "running" | "error" | "complete";
  duration?: string;
  stats?: string;
  errorMessage?: string;
  resultDetail?: ReactNode;
};

function toActivityCall(part: ChatStepPart | ChatToolPart): ActivityCall {
  if (part.type === "step") {
    return {
      key: part.id,
      name: "准备",
      target: stepTarget(part),
      status: part.status,
      duration: formatDuration(part.startedAt, part.endedAt),
      errorMessage: part.status === "error" ? part.label : undefined,
    };
  }
  const output = commandBody(part.output);
  const failed =
    part.status === "error" || (part.exitCode != null && part.exitCode !== 0);
  return {
    key: part.id,
    name: "shell",
    target: commandLabel(part.command),
    node: "sandbox",
    status:
      part.status === "running" && !part.background
        ? "running"
        : failed
          ? "error"
          : "complete",
    duration: formatDuration(part.startedAt, part.endedAt),
    stats: part.background ? "后台" : undefined,
    errorMessage: failed ? "命令执行失败" : undefined,
    resultDetail: output ? (
      <CodeBlock
        code={output}
        title="命令输出"
        size="sm"
        width="100%"
        maxHeight={240}
        isWrapped
        hasLineNumbers={false}
      />
    ) : undefined,
  };
}

type TranscriptBlock =
  | { kind: "activity"; calls: ActivityCall[] }
  | { kind: "text"; text: string };

function transcriptBlocks(parts: ChatMessagePart[]): TranscriptBlock[] {
  const blocks: TranscriptBlock[] = [];
  let calls: ActivityCall[] = [];
  const flush = () => {
    if (calls.length === 0) return;
    blocks.push({ kind: "activity", calls });
    calls = [];
  };
  for (const part of parts) {
    if (part.type === "text") {
      if (!part.text.trim()) continue;
      flush();
      blocks.push({ kind: "text", text: part.text });
      continue;
    }
    calls.push(toActivityCall(part));
  }
  flush();
  return blocks;
}

const GENERATION_FAILURE_MARKER = "生成失败：";

function splitGenerationFailure(text: string): {
  body: string;
  failure: string | null;
} {
  const trimmed = text.trim();
  if (trimmed.startsWith(GENERATION_FAILURE_MARKER)) {
    return {
      body: "",
      failure: trimmed.slice(GENERATION_FAILURE_MARKER.length).trim(),
    };
  }
  const marker = `\n\n${GENERATION_FAILURE_MARKER}`;
  const index = trimmed.lastIndexOf(marker);
  if (index < 0) return { body: text, failure: null };
  return {
    body: trimmed.slice(0, index).trim(),
    failure: trimmed.slice(index + marker.length).trim(),
  };
}

function MessageHoverBar({
  text,
  timestamp,
}: {
  text: string;
  timestamp?: string;
}) {
  const { copy, isCopied } = useClipboard({ announce: "已复制" });
  const copyText = text.trim();
  if (!timestamp && !copyText) return null;

  return (
    <div className="chat-message-hover">
      {timestamp ? (
        <ChatMessageMetadata
          timestamp={<Timestamp value={timestamp} format="time" />}
        />
      ) : null}
      {copyText ? (
        <Button
          label={isCopied ? "已复制" : "复制"}
          variant="ghost"
          size="sm"
          isIconOnly
          icon={<Icon icon={isCopied ? "check" : "copy"} size="sm" />}
          onClick={() => void copy(copyText)}
        />
      ) : null}
    </div>
  );
}

function AssistantMessageView({
  content,
  parts,
  timestamp,
  icon,
  isLive = false,
}: {
  content: string;
  parts: ChatMessagePart[];
  timestamp?: string;
  icon: ModelProviderIconId;
  isLive?: boolean;
}) {
  const blocks = transcriptBlocks(parts);
  const hasText = blocks.some((block) => block.kind === "text");
  const transcript = blocks
    .flatMap((block) => (block.kind === "text" ? [block.text.trim()] : []))
    .filter(Boolean)
    .join("\n\n");
  const fallback =
    !hasText && blocks.length === 0 ? content.trim() : "";
  const copyText = transcript || fallback;

  return (
    <ChatMessage
      sender="assistant"
      avatar={
        <span className="chat-provider-avatar">
          <ModelProviderIcon icon={icon} size={20} />
        </span>
      }
    >
      {blocks.map((block, index) => {
        if (block.kind === "activity") {
          return (
            <div className="chat-activity" key={`activity-${index}`}>
              <ChatToolCalls
                defaultIsExpanded={isLive}
                label={`${block.calls.length} 个步骤`}
                calls={block.calls}
              />
            </div>
          );
        }
        const { body, failure } = splitGenerationFailure(block.text);
        return (
          <Fragment key={`text-${index}`}>
            {body ? (
              <ChatMessageBubble variant="ghost" width="100%">
                <Markdown density="compact" contentWidth="100%">
                  {body}
                </Markdown>
              </ChatMessageBubble>
            ) : null}
            {failure !== null ? (
              <Banner
                status="error"
                title="生成失败"
                description={failure || undefined}
                className="chat-failure-banner"
              />
            ) : null}
          </Fragment>
        );
      })}
      {fallback ? (
        <ChatMessageBubble variant="ghost" width="100%">
          <Markdown density="compact" contentWidth="100%">
            {fallback}
          </Markdown>
        </ChatMessageBubble>
      ) : null}
      {timestamp ? (
        <MessageHoverBar text={copyText} timestamp={timestamp} />
      ) : null}
      {isLive ? (
        <div className="chat-live-loading" role="status">
          <Spinner size="sm" shade="subtle" aria-hidden="true" />
          <Text type="supporting">loading...</Text>
        </div>
      ) : null}
    </ChatMessage>
  );
}

export function ChatSessionView({
  initialSession,
  initialProjects,
  initialModels,
  initialChatWidth,
  initialWorkspaceTabs,
}: {
  initialSession: ChatSessionDetail;
  initialProjects: ProjectSummary[];
  initialModels: AvailableModelOption[];
  initialChatWidth?: number | null;
  initialWorkspaceTabs?: PersistedWorkspaceTabs;
}) {
  const router = useRouter();
  const toast = useAppToast();

  const [session, setSession] = useState<ChatSessionDetail>(initialSession);
  const [projects, setProjects] = useState<ProjectSummary[]>(initialProjects);
  const [selectedModelId, setSelectedModelId] = useState<string | null>(
    () =>
      initialModels.find((item) => item.isDefault)?.id ??
      initialModels[0]?.id ??
      null
  );
  const fallbackModelIcon: ModelProviderIconId =
    initialModels.find((item) => item.isDefault)?.icon ??
    initialModels[0]?.icon ??
    "openai";
  const [sending, setSending] = useState(false);
  const [isAwayFromBottom, setIsAwayFromBottom] = useState(false);
  const [draft, setDraft] = useState<LiveDraft | null>(null);
  const [queue, setQueue] = useState<QueuedTurn[]>([]);
  const queueRef = useRef<QueuedTurn[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  const runningRef = useRef(false);
  const stopQueueRef = useRef(false);
  const queueIdRef = useRef(0);
  const autoRanRef = useRef(false);
  const [creatingSession, setCreatingSession] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(true);
  const [isChatTransitioning, setIsChatTransitioning] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isMobileDialogOpen, setIsMobileDialogOpen] = useState(false);
  const [openHeaderMenu, setOpenHeaderMenu] = useState<
    "project" | "session" | null
  >(null);

  // Create / edit project modal state
  const [projectDialog, setProjectDialog] = useState<
    | { mode: "create"; nonce: number }
    | { mode: "edit"; project: ProjectSummary; nonce: number }
    | null
  >(null);
  const projectDialogNonceRef = useRef(0);

  // Rename session modal state
  const [renameSessionNonce, setRenameSessionNonce] = useState<number | null>(
    null
  );
  const renameSessionNonceRef = useRef(0);

  const rootRef = useRef<HTMLElement>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const transitionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hoverCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const currentProject =
    projects.find((item) => item.id === session.projectId) ?? null;
  const activeProjectName =
    currentProject?.name ?? session.projectName ?? "未分类 Project";
  const projectSessions =
    currentProject?.sessions ?? [
      {
        id: session.id,
        projectId: session.projectId,
        title: session.title,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
      },
    ];

  useIsomorphicLayoutEffect(() => {
    const el = chatScrollRef.current;
    if (!el) return;

    let stopped = false;
    let pinning = false;
    let settleTimer: ReturnType<typeof setTimeout> | null = null;

    const pinToBottom = () => {
      if (stopped) return;
      const target = el.scrollHeight - el.clientHeight;
      if (target <= 0 || Math.abs(el.scrollTop - target) < 1) return;
      pinning = true;
      el.scrollTop = target;
      requestAnimationFrame(() => {
        pinning = false;
      });
    };

    const stopPinning = () => {
      if (stopped) return;
      stopped = true;
      if (settleTimer) {
        clearTimeout(settleTimer);
        settleTimer = null;
      }
      observer?.disconnect();
      el.removeEventListener("scroll", onScroll);
    };

    const onScroll = () => {
      if (pinning) {
        pinning = false;
        return;
      }
      const remaining = el.scrollHeight - el.scrollTop - el.clientHeight;
      if (remaining > 48) stopPinning();
    };

    const observer =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(() => {
            pinToBottom();
          })
        : null;

    pinToBottom();

    if (observer) {
      observer.observe(el);
      if (el.firstElementChild) {
        observer.observe(el.firstElementChild);
      }
    }

    el.addEventListener("scroll", onScroll, { passive: true });

    if (document.fonts?.ready) {
      void document.fonts.ready.then(() => {
        pinToBottom();
      });
    }
    settleTimer = setTimeout(stopPinning, 1200);

    return stopPinning;
    // Opens the session on the latest message. Later growth is followed by
    // ChatLayout only while the reader stays at the bottom.
  }, [session.id]);

  useEffect(() => {
    const el = chatScrollRef.current;
    if (!el) return;
    const update = () => {
      const away = el.scrollHeight - el.scrollTop - el.clientHeight > 80;
      setIsAwayFromBottom((current) => (current === away ? current : away));
    };
    update();
    el.addEventListener("scroll", update, { passive: true });
    const content = el.firstElementChild;
    const observer =
      content && typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(update)
        : null;
    if (content) observer?.observe(content);
    return () => {
      el.removeEventListener("scroll", update);
      observer?.disconnect();
    };
  }, [session.id]);

  function scrollMessagesToBottom() {
    const el = chatScrollRef.current;
    if (!el) return;
    el.scrollTop = Math.max(0, el.scrollHeight - el.clientHeight);
  }

  useEffect(() => {
    const media = window.matchMedia(`(max-width: ${MOBILE_MAX_WIDTH}px)`);
    const update = () => setIsMobile(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    return () => {
      if (transitionTimerRef.current) {
        clearTimeout(transitionTimerRef.current);
      }
      if (hoverCloseTimerRef.current) {
        clearTimeout(hoverCloseTimerRef.current);
      }
    };
  }, []);

  function clearHoverCloseTimer() {
    if (hoverCloseTimerRef.current) {
      clearTimeout(hoverCloseTimerRef.current);
      hoverCloseTimerRef.current = null;
    }
  }

  function openHeaderMenuOnHover(menu: "project" | "session") {
    clearHoverCloseTimer();
    setOpenHeaderMenu(menu);
  }

  function scheduleHeaderMenuClose(menu: "project" | "session") {
    clearHoverCloseTimer();
    hoverCloseTimerRef.current = setTimeout(() => {
      setOpenHeaderMenu((current) => (current === menu ? null : current));
      hoverCloseTimerRef.current = null;
    }, 150);
  }

  function handleSelectProject(projectId: string) {
    clearHoverCloseTimer();
    setOpenHeaderMenu(null);
    if (projectId === session.projectId) return;
    const targetProject = projects.find((item) => item.id === projectId);
    if (!targetProject) return;
    if (targetProject.sessions.length > 0) {
      router.push(`/chat/${targetProject.sessions[0].id}`);
    } else {
      router.push(`/?project=${encodeURIComponent(targetProject.id)}`);
    }
  }

  function handleSelectSession(sessionId: string) {
    clearHoverCloseTimer();
    setOpenHeaderMenu(null);
    if (sessionId === session.id) return;
    router.push(`/chat/${sessionId}`);
  }

  async function handleNewSessionInCurrentProject() {
    if (creatingSession) return;
    clearHoverCloseTimer();
    setOpenHeaderMenu(null);

    const targetProjectId = session.projectId ?? projects[0]?.id;
    if (!targetProjectId) {
      toast({
        body: "请先创建 Project",
        type: "error",
        uniqueID: "create-session-err",
      });
      return;
    }

    setCreatingSession(true);
    try {
      const { session: created } = await apiClient.createSession(
        "",
        targetProjectId
      );
      router.push(`/chat/${created.id}`);
    } catch (error) {
      toast({
        body: error instanceof Error ? error.message : "新增会话失败",
        type: "error",
        uniqueID: "create-session-err",
      });
      setCreatingSession(false);
    }
  }

  function openCreateProjectModal() {
    clearHoverCloseTimer();
    setOpenHeaderMenu(null);
    projectDialogNonceRef.current += 1;
    setProjectDialog({ mode: "create", nonce: projectDialogNonceRef.current });
  }

  function openEditProjectModal() {
    if (!currentProject) return;
    clearHoverCloseTimer();
    setOpenHeaderMenu(null);
    projectDialogNonceRef.current += 1;
    setProjectDialog({
      mode: "edit",
      project: currentProject,
      nonce: projectDialogNonceRef.current,
    });
  }

  function openRenameSessionModal() {
    clearHoverCloseTimer();
    setOpenHeaderMenu(null);
    renameSessionNonceRef.current += 1;
    setRenameSessionNonce(renameSessionNonceRef.current);
  }

  async function handleSubmitSessionRename(nextTitle: string) {
    const { session: updated } = await apiClient.renameSession(
      session.id,
      nextTitle
    );
    setSession((prev) => ({
      ...prev,
      title: updated.title,
      updatedAt: updated.updatedAt,
    }));
    setProjects((prev) =>
      prev.map((project) => ({
        ...project,
        sessions: project.sessions.map((item) =>
          item.id === updated.id ? updated : item
        ),
      }))
    );
    toast({
      body: "已重命名会话",
      uniqueID: `rename-session-${updated.id}`,
    });
  }

  async function handleSubmitProjectForm(values: ProjectFormValues) {
    if (!projectDialog) return;
    if (projectDialog.mode === "create") {
      const { project } = await apiClient.createProject({
        name: values.name,
        description: values.description || undefined,
      });
      setProjects((prev) => [project, ...prev]);
      toast({ body: "已创建 Project", uniqueID: "create-project-ok" });
      router.push(`/?project=${encodeURIComponent(project.id)}`);
      return;
    }

    const { project: updated } = await apiClient.updateProject(
      projectDialog.project.id,
      {
        name: values.name,
        description: values.description ?? "",
      }
    );
    setProjects((prev) =>
      prev.map((item) => (item.id === updated.id ? updated : item))
    );
    setSession((prev) =>
      prev.projectId === updated.id
        ? { ...prev, projectName: updated.name }
        : prev
    );
    toast({ body: "已更新 Project", uniqueID: `update-project-${updated.id}` });
  }

  const [defaultChatWidth] = useState<number>(
    () =>
      readChatPanelWidthFromDocument() ??
      initialChatWidth ??
      CHAT_PANEL_DEFAULT_WIDTH
  );
  const [maxChatWidth, setMaxChatWidth] = useState<number>(
    CHAT_PANEL_MAX_WIDTH
  );
  const lastSavedWidthRef = useRef<number>(defaultChatWidth);

  useEffect(() => {
    const el = rootRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const updateMax = () => {
      const width = el.clientWidth;
      if (width <= MOBILE_MAX_WIDTH) return;
      const nextMax = Math.max(
        CHAT_PANEL_MIN_WIDTH,
        Math.min(CHAT_PANEL_MAX_WIDTH, Math.floor(width - 360))
      );
      setMaxChatWidth((prev) => (prev === nextMax ? prev : nextMax));
    };
    updateMax();
    const observer = new ResizeObserver(updateMax);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const chatResize = useResizable({
    defaultSize: defaultChatWidth,
    minSize: CHAT_PANEL_MIN_WIDTH,
    maxSize: maxChatWidth,
    onSizeChange: (nextSize) => {
      const rounded = Math.round(nextSize);
      if (
        rounded >= CHAT_PANEL_MIN_WIDTH &&
        rounded !== lastSavedWidthRef.current
      ) {
        lastSavedWidthRef.current = rounded;
        writeChatPanelWidthCookie(rounded);
      }
    },
  });

  function setDesktopChatOpen(nextOpen: boolean) {
    setIsChatTransitioning(true);
    setIsChatOpen(nextOpen);
    if (transitionTimerRef.current) {
      clearTimeout(transitionTimerRef.current);
    }
    transitionTimerRef.current = setTimeout(() => {
      setIsChatTransitioning(false);
      transitionTimerRef.current = null;
    }, 320);
  }

  function toggleChatPanel() {
    const width = rootRef.current?.offsetWidth ?? Infinity;
    if (width <= MOBILE_MAX_WIDTH) {
      setIsMobileDialogOpen((open) => !open);
    } else {
      setDesktopChatOpen(!isChatOpen);
    }
  }

  function applySession(updated: ChatSessionDetail) {
    setSession(updated);
    setProjects((prev) =>
      prev.map((project) =>
        project.id === updated.projectId
          ? {
              ...project,
              sessions: project.sessions.map((item) =>
                item.id === updated.id
                  ? {
                      ...item,
                      title: updated.title,
                      updatedAt: updated.updatedAt,
                    }
                  : item
              ),
            }
          : project
      )
    );
  }

  function applyWorkspace(update: {
    files: ProjectFile[];
    previewUrl: string | null;
  }) {
    setSession((prev) => ({
      ...prev,
      files: update.files,
      previewUrl: update.previewUrl,
    }));
  }

  function syncQueue(next: QueuedTurn[]) {
    queueRef.current = next;
    setQueue(next);
  }

  function nextQueueId(): string {
    queueIdRef.current += 1;
    return `queue-${queueIdRef.current}`;
  }

  async function refreshAfterRun(waitForAssistant: boolean): Promise<boolean> {
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const refreshed = await apiClient.getSession(session.id).catch(() => null);
      if (!refreshed) return false;
      applySession(refreshed.session);
      const last = refreshed.session.messages.at(-1);
      if (!waitForAssistant || last?.role === "assistant") return true;
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    return true;
  }

  async function runAgent(input: {
    content?: string;
    continueExisting?: boolean;
    modelId?: string | null;
  }): Promise<boolean> {
    const content = input.content?.trim() ?? "";
    if (!input.continueExisting && !content) return false;
    if (stopQueueRef.current) return false;

    const modelId =
      input.modelId === undefined ? selectedModelId : input.modelId;
    const draftIcon: ModelProviderIconId =
      initialModels.find((item) => item.id === modelId)?.icon ??
      fallbackModelIcon;
    const controller = new AbortController();
    abortRef.current = controller;
    setDraft({ parts: [], icon: draftIcon });
    const snapshot = session;
    if (!input.continueExisting) {
      setSession((prev) => ({
        ...prev,
        messages: [
          ...prev.messages,
          {
            id: `local-${Date.now()}`,
            sessionId: prev.id,
            role: "user",
            content,
            parts: [],
            modelIcon: null,
            artifactTitle: null,
            createdAt: new Date().toISOString(),
          },
        ],
      }));
    }

    let completed = false;
    try {
      await apiClient.streamSession(
        session.id,
        {
          content: input.continueExisting ? undefined : content,
          modelId,
          continueExisting: input.continueExisting,
        },
        (event, data) => {
          if (event === "status" && data.steps) {
            setDraft((prev) =>
              prev ? { ...prev, parts: withSteps(prev.parts, data.steps ?? []) } : prev
            );
          } else if (event === "text" && data.delta) {
            setDraft((prev) =>
              prev
                ? { ...prev, parts: withText(prev.parts, data.delta ?? "") }
                : prev
            );
          } else if (event === "tool" && data.tool) {
            const toolPart = data.tool;
            setDraft((prev) =>
              prev ? { ...prev, parts: withTool(prev.parts, toolPart) } : prev
            );
          } else if (event === "files") {
            setSession((prev) => ({
              ...prev,
              files: data.files ?? prev.files,
              previewUrl:
                data.previewUrl === undefined
                  ? prev.previewUrl
                  : data.previewUrl,
            }));
          } else if (event === "done" && data.session) {
            completed = true;
            applySession(data.session);
            setDraft(null);
          } else if (event === "error") {
            if (controller.signal.aborted) return;
            toast({
              body: data.message || "生成失败",
              type: "error",
              uniqueID: "send-message-err",
            });
          }
        },
        controller.signal
      );
      if (!completed) {
        await refreshAfterRun(controller.signal.aborted);
      }
      return completed;
    } catch (error) {
      const aborted = controller.signal.aborted || isAbortError(error);
      const refreshed = await refreshAfterRun(aborted);
      if (!refreshed && !aborted) setSession(snapshot);
      if (!aborted) {
        toast({
          body: error instanceof Error ? error.message : "发送消息失败",
          type: "error",
          uniqueID: "send-message-err",
        });
      }
      return false;
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
      setDraft(null);
    }
  }

  async function drain(input: {
    content?: string;
    continueExisting?: boolean;
    modelId?: string | null;
  }) {
    let current: {
      content?: string;
      continueExisting?: boolean;
      modelId?: string | null;
    } | null = input;
    while (current && !stopQueueRef.current) {
      await runAgent(current);
      if (stopQueueRef.current) break;
      const next = queueRef.current[0];
      if (!next) break;
      syncQueue(queueRef.current.slice(1));
      current = { content: next.content, modelId: next.modelId };
    }
    stopQueueRef.current = false;
  }

  function startRun(input: {
    content?: string;
    continueExisting?: boolean;
    modelId?: string | null;
  }) {
    if (runningRef.current) return;
    runningRef.current = true;
    stopQueueRef.current = false;
    setSending(true);
    void drain(input).finally(() => {
      runningRef.current = false;
      setSending(false);
      setDraft(null);
    });
  }

  function handleQueue(content: string) {
    const text = content.trim();
    if (!text) return;
    if (!runningRef.current) {
      startRun({ content: text, modelId: selectedModelId });
      return;
    }
    syncQueue([
      ...queueRef.current,
      { id: nextQueueId(), content: text, modelId: selectedModelId },
    ]);
  }

  function handleSendQueued(id: string) {
    const item = queueRef.current.find((entry) => entry.id === id);
    if (!item) return;
    const rest = queueRef.current.filter((entry) => entry.id !== id);
    if (!runningRef.current) {
      syncQueue(rest);
      startRun({ content: item.content, modelId: item.modelId });
      return;
    }
    stopQueueRef.current = false;
    syncQueue([item, ...rest]);
    abortRef.current?.abort();
  }

  function handleCancel() {
    if (!runningRef.current) return;
    stopQueueRef.current = true;
    syncQueue([]);
    abortRef.current?.abort();
  }

  function handleRemoveQueued(id: string) {
    syncQueue(queueRef.current.filter((item) => item.id !== id));
  }

  useEffect(() => {
    if (autoRanRef.current) return;
    const last = initialSession.messages.at(-1);
    if (!last || last.role !== "user") return;
    if (initialSession.messages.some((message) => message.role === "assistant")) {
      return;
    }
    autoRanRef.current = true;
    startRun({ continueExisting: true, modelId: selectedModelId });
    // The first prompt is already stored on the session. Run it once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialSession.id]);

  function handleSend(value: string) {
    const text = value.trim();
    if (!text) return;
    if (runningRef.current) {
      handleQueue(text);
      return;
    }
    startRun({ content: text, modelId: selectedModelId });
  }

  return (
    <VStack ref={rootRef} style={rootStyle}>
      <Layout
        height="fill"
        content={
          <LayoutContent role="main" padding={0}>
            <VisuallyHidden as="h1">{session.title}</VisuallyHidden>
            <HStack height="100%">
              {/* Left panel: Resizable & collapsible Chat detail area */}
              <div
                className="ai-chat-panel"
                data-open={isChatOpen ? "true" : "false"}
                data-transitioning={isChatTransitioning ? "true" : "false"}
                aria-hidden={!isMobile && !isChatOpen}
                inert={(!isMobile && !isChatOpen) || undefined}
                style={chatPanelWidthVar(chatResize.size)}
              >
                <div className="ai-chat-panel-inner">
                  <Toolbar
                    label="会话操作"
                    dividers={["bottom"]}
                    className="chat-header-toolbar"
                    startContent={
                      <HStack
                        gap={1}
                        vAlign="center"
                        style={{ minWidth: 0, flex: 1 }}
                      >
                        <Button
                          label="返回"
                          variant="ghost"
                          size="sm"
                          icon={<Icon icon={ArrowLeftIcon} size="sm" />}
                          isIconOnly
                          style={{ flexShrink: 0 }}
                          onClick={() => router.push("/")}
                        />
                      <Popover
                        isOpen={openHeaderMenu === "project"}
                        onOpenChange={(isOpen) => {
                          clearHoverCloseTimer();
                          setOpenHeaderMenu(isOpen ? "project" : null);
                        }}
                        placement="below"
                        alignment="start"
                        width={240}
                        padding={1}
                        role="none"
                        isModal={false}
                        hasAutoFocus={false}
                        hasCloseButton={false}
                        content={
                          <div
                            role="menu"
                            aria-label="切换 Project"
                            className="chat-header-menu"
                            onMouseEnter={() =>
                              openHeaderMenuOnHover("project")
                            }
                            onMouseLeave={() =>
                              scheduleHeaderMenuClose("project")
                            }
                          >
                            {projects.map((project) => {
                              const isSelected =
                                project.id === session.projectId;
                              return (
                                <button
                                  key={project.id}
                                  type="button"
                                  role="menuitemradio"
                                  aria-checked={isSelected}
                                  className="chat-header-menu-item"
                                  onClick={() =>
                                    handleSelectProject(project.id)
                                  }
                                >
                                  <span className="chat-header-menu-item-label">
                                    <Text type="body" maxLines={1}>
                                      {project.name}
                                    </Text>
                                  </span>
                                  <CheckIndicator
                                    state={
                                      isSelected ? "checked" : "unchecked"
                                    }
                                    size="sm"
                                  />
                                </button>
                              );
                            })}
                            {projects.length > 0 && (
                              <div className="chat-header-menu-divider">
                                <Divider />
                              </div>
                            )}
                            {currentProject && (
                              <button
                                type="button"
                                role="menuitem"
                                className="chat-header-menu-item"
                                onClick={openEditProjectModal}
                              >
                                <Icon
                                  icon={PencilSquareIcon}
                                  size="sm"
                                  color="secondary"
                                />
                                <span className="chat-header-menu-item-label">
                                  <Text type="body" maxLines={1}>
                                    编辑当前 Project
                                  </Text>
                                </span>
                              </button>
                            )}
                            <button
                              type="button"
                              role="menuitem"
                              className="chat-header-menu-item"
                              onClick={openCreateProjectModal}
                            >
                              <Icon
                                icon={PlusIcon}
                                size="sm"
                                color="secondary"
                              />
                              <span className="chat-header-menu-item-label">
                                <Text type="body" maxLines={1}>
                                  新增 Project
                                </Text>
                              </span>
                            </button>
                          </div>
                        }
                      >
                        {(triggerProps) => (
                          <button
                            type="button"
                            className="chat-header-switcher-trigger"
                            aria-label={`切换 Project：${activeProjectName}`}
                            {...triggerProps}
                            onMouseEnter={() =>
                              openHeaderMenuOnHover("project")
                            }
                            onMouseLeave={() =>
                              scheduleHeaderMenuClose("project")
                            }
                          >
                            <span className="chat-header-switcher-label chat-header-switcher-label--project">
                              <Text type="label" weight="medium" maxLines={1}>
                                {activeProjectName}
                              </Text>
                            </span>
                            <Icon
                              icon="chevronDown"
                              size="sm"
                              color="secondary"
                            />
                          </button>
                        )}
                      </Popover>
                      <Text
                        type="label"
                        color="secondary"
                        style={{ flexShrink: 0 }}
                      >
                        /
                      </Text>
                      <Popover
                        isOpen={openHeaderMenu === "session"}
                        onOpenChange={(isOpen) => {
                          clearHoverCloseTimer();
                          setOpenHeaderMenu(isOpen ? "session" : null);
                        }}
                        placement="below"
                        alignment="start"
                        width={240}
                        padding={1}
                        role="none"
                        isModal={false}
                        hasAutoFocus={false}
                        hasCloseButton={false}
                        content={
                          <div
                            role="menu"
                            aria-label="切换会话"
                            className="chat-header-menu"
                            onMouseEnter={() =>
                              openHeaderMenuOnHover("session")
                            }
                            onMouseLeave={() =>
                              scheduleHeaderMenuClose("session")
                            }
                          >
                            {projectSessions.map((item) => {
                              const isSelected = item.id === session.id;
                              return (
                                <button
                                  key={item.id}
                                  type="button"
                                  role="menuitemradio"
                                  aria-checked={isSelected}
                                  className="chat-header-menu-item"
                                  onClick={() => handleSelectSession(item.id)}
                                >
                                  <span className="chat-header-menu-item-label">
                                    <Text type="body" maxLines={1}>
                                      {item.title}
                                    </Text>
                                  </span>
                                  <CheckIndicator
                                    state={
                                      isSelected ? "checked" : "unchecked"
                                    }
                                    size="sm"
                                  />
                                </button>
                              );
                            })}
                            <div className="chat-header-menu-divider">
                              <Divider />
                            </div>
                            <button
                              type="button"
                              role="menuitem"
                              className="chat-header-menu-item"
                              onClick={openRenameSessionModal}
                            >
                              <Icon
                                icon={PencilSquareIcon}
                                size="sm"
                                color="secondary"
                              />
                              <span className="chat-header-menu-item-label">
                                <Text type="body" maxLines={1}>
                                  重命名当前会话
                                </Text>
                              </span>
                            </button>
                            <button
                              type="button"
                              role="menuitem"
                              className="chat-header-menu-item"
                              disabled={creatingSession}
                              onClick={() =>
                                void handleNewSessionInCurrentProject()
                              }
                            >
                              <Icon
                                icon={PlusIcon}
                                size="sm"
                                color="secondary"
                              />
                              <span className="chat-header-menu-item-label">
                                <Text type="body" maxLines={1}>
                                  {creatingSession ? "正在创建…" : "新增会话"}
                                </Text>
                              </span>
                            </button>
                          </div>
                        }
                      >
                        {(triggerProps) => (
                          <button
                            type="button"
                            className="chat-header-switcher-trigger"
                            aria-label={`切换会话：${session.title}`}
                            {...triggerProps}
                            onMouseEnter={() =>
                              openHeaderMenuOnHover("session")
                            }
                            onMouseLeave={() =>
                              scheduleHeaderMenuClose("session")
                            }
                          >
                            <span className="chat-header-switcher-label chat-header-switcher-label--session">
                              <Text type="label" weight="medium" maxLines={1}>
                                {session.title}
                              </Text>
                            </span>
                            <Icon
                              icon="chevronDown"
                              size="sm"
                              color="secondary"
                            />
                          </button>
                        )}
                      </Popover>
                    </HStack>
                  }
                  endContent={
                    <Button
                      label={isMobile ? "查看工作空间" : "收起聊天区域"}
                      variant="ghost"
                      size="sm"
                      icon={<Icon icon={ViewColumnsIcon} size="sm" />}
                      isIconOnly
                      onClick={toggleChatPanel}
                    />
                  }
                />

                <ChatLayout
                  id={CHAT_SCROLL_CONTAINER_ID}
                  ref={chatScrollRef}
                  density="balanced"
                  style={chatLayoutStyle}
                  scrollButton={
                    <ChatLayoutScrollButton
                      isVisible={isAwayFromBottom}
                      onClick={scrollMessagesToBottom}
                    />
                  }
                  emptyState={
                    <EmptyState
                      title="开始新会话"
                      description="在下方输入框发送消息，开启当前 Project 的新对话"
                    />
                  }
                  composer={
                    <AgentChatComposer
                      onSubmit={handleSend}
                      isRunning={sending}
                      queue={queue}
                      onStop={handleCancel}
                      onQueue={handleQueue}
                      onSendQueued={handleSendQueued}
                      onRemoveQueued={handleRemoveQueued}
                      models={initialModels}
                      selectedModelId={selectedModelId}
                      onSelectModel={setSelectedModelId}
                      projectId={session.projectId}
                    />
                  }
                >
                  {(session.messages.length > 0 || draft) && (
                    <ChatMessageList>
                      {session.messages.map((message) =>
                        message.role === "user" ? (
                          <ChatMessage key={message.id} sender="user">
                            <ChatMessageBubble
                              metadata={
                                <MessageHoverBar
                                  text={message.content}
                                  timestamp={message.createdAt}
                                />
                              }
                            >
                              {message.content}
                            </ChatMessageBubble>
                          </ChatMessage>
                        ) : (
                          <AssistantMessageView
                            key={message.id}
                            content={message.content}
                            parts={message.parts}
                            timestamp={message.createdAt}
                            icon={message.modelIcon ?? fallbackModelIcon}
                          />
                        )
                      )}
                      {draft ? (
                        <AssistantMessageView
                          isLive
                          icon={draft.icon}
                          content=""
                          parts={draft.parts}
                        />
                      ) : null}
                    </ChatMessageList>
                  )}
                </ChatLayout>
                </div>
              </div>

              {/* Resize handle between Chat detail area and Workspace panel */}
              <div
                className="ai-chat-resize-wrap"
                data-open={isChatOpen ? "true" : "false"}
                data-transitioning={isChatTransitioning ? "true" : "false"}
                aria-hidden={!isChatOpen}
              >
                <ResizeHandle
                  direction="horizontal"
                  resizable={chatResize.props}
                  pillPlacement="center"
                  isAlwaysVisible={false}
                  hasDivider
                  label="调整聊天区域宽度"
                  className="ai-chat-resize-handle"
                />
              </div>

              {/* Desktop right panel: IDE + Preview fills remaining width */}
              <Card
                variant="transparent"
                padding={0}
                height="100%"
                className="ai-chat-workspace-panel"
              >
                <IdePreviewPanel
                  storageScopeKey={session.projectId ?? session.id}
                  projectId={session.projectId}
                  title={session.title}
                  projectName={activeProjectName}
                  files={session.files}
                  devServerUrl={session.previewUrl}
                  initialTabs={initialWorkspaceTabs}
                  onWorkspaceChange={applyWorkspace}
                  leadingAction={
                    !isChatOpen ? (
                      <Button
                        label="展开聊天区域"
                        variant="ghost"
                        size="sm"
                        icon={<Icon icon={ViewColumnsIcon} size="sm" />}
                        isIconOnly
                        style={{ flexShrink: 0 }}
                        onClick={() => setDesktopChatOpen(true)}
                      />
                    ) : null
                  }
                />
              </Card>
            </HStack>
          </LayoutContent>
        }
      />

      {/* Mobile fullscreen dialog for IDE / Preview */}
      <Dialog
        isOpen={isMobileDialogOpen}
        onOpenChange={setIsMobileDialogOpen}
        purpose="info"
        variant="fullscreen"
      >
        <Layout
          height="fill"
          header={
            <DialogHeader
              title={session.title}
              subtitle="代码与预览"
              hasDivider
              onOpenChange={setIsMobileDialogOpen}
            />
          }
          content={
            <LayoutContent padding={0}>
              <IdePreviewPanel
                storageScopeKey={session.projectId ?? session.id}
                projectId={session.projectId}
                title={session.title}
                projectName={activeProjectName}
                files={session.files}
                devServerUrl={session.previewUrl}
                initialTabs={initialWorkspaceTabs}
                onWorkspaceChange={applyWorkspace}
              />
            </LayoutContent>
          }
        />
      </Dialog>

      {projectDialog && (
        <ProjectFormDialog
          key={
            projectDialog.mode === "edit"
              ? `edit-${projectDialog.project.id}-${projectDialog.nonce}`
              : `create-${projectDialog.nonce}`
          }
          isOpen
          mode={projectDialog.mode}
          initialName={
            projectDialog.mode === "edit" ? projectDialog.project.name : ""
          }
          initialDescription={
            projectDialog.mode === "edit"
              ? projectDialog.project.description
              : ""
          }
          onOpenChange={(open) => {
            if (!open) setProjectDialog(null);
          }}
          onSubmit={handleSubmitProjectForm}
        />
      )}

      {renameSessionNonce !== null && (
        <SessionRenameDialog
          key={`rename-session-${session.id}-${renameSessionNonce}`}
          isOpen
          initialTitle={session.title}
          onOpenChange={(open) => {
            if (!open) setRenameSessionNonce(null);
          }}
          onSubmit={handleSubmitSessionRename}
        />
      )}
    </VStack>
  );
}
