"use client";

import {
  Fragment,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { useRouter } from "next/navigation";
import {
  HStack,
  VStack,
  StackItem,
  Layout,
  LayoutContent,
} from "@astryxdesign/core/Layout";
import { Text } from "@astryxdesign/core/Text";
import { Toolbar } from "@astryxdesign/core/Toolbar";
import {
  ChatLayout,
  ChatMessage,
  ChatMessageBubble,
  ChatMessageList,
  ChatMessageMetadata,
  ChatSystemMessage,
  ChatTokenizedText,
  ChatToolCalls,
} from "@astryxdesign/core/Chat";
import { Avatar } from "@astryxdesign/core/Avatar";
import { Card } from "@astryxdesign/core/Card";
import { ClickableCard } from "@astryxdesign/core/ClickableCard";
import { CodeBlock } from "@astryxdesign/core/CodeBlock";
import { Markdown } from "@astryxdesign/core/Markdown";
import { Timestamp } from "@astryxdesign/core/Timestamp";
import { Token } from "@astryxdesign/core/Token";
import { Button } from "@astryxdesign/core/Button";
import { Divider } from "@astryxdesign/core/Divider";
import { EmptyState } from "@astryxdesign/core/EmptyState";
import { Icon } from "@astryxdesign/core/Icon";
import { CheckIndicator } from "@astryxdesign/core/Indicator";
import { Dialog, DialogHeader } from "@astryxdesign/core/Dialog";
import { Popover } from "@astryxdesign/core/Popover";
import { useResizable, ResizeHandle } from "@astryxdesign/core/Resizable";
import { rtlStyles } from "@astryxdesign/core/utils";
import { VisuallyHidden } from "@astryxdesign/core/VisuallyHidden";
import {
  ArrowLeftIcon,
  DocumentTextIcon as DocumentIcon,
  ChevronRightIcon,
  PencilSquareIcon,
  PlusIcon,
  ViewColumnsIcon,
} from "@heroicons/react/24/outline";
import { AgentChatComposer } from "@/components/agent-chat-composer";
import { useAppToast } from "@/components/app-toast";
import {
  IdePreviewPanel,
  type PersistedWorkspaceTabs,
  type WorkspacePanelTab,
  type WorkspaceTabRequest,
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
  ChatSessionDetail,
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

const MENTION_TOKENS = [
  { value: "@agent", label: "@Agent", variant: "blue" as const },
];

const ARTIFACT_TITLE = "JWT Token Refresh: Design & Rollout";

const DEMO_MIDDLEWARE_CODE = `async function authMiddleware(req: Request) {
  try {
    const decoded = validateToken(req.headers.authorization);
    req.user = decoded;
  } catch (err) {
    if (err instanceof TokenExpiredError) {
      // Attempt silent refresh before rejecting
      const refreshed = await refreshToken(req.cookies.refreshToken);
      if (refreshed) {
        req.user = refreshed.user;
        req.newAccessToken = refreshed.accessToken;
        return next(req);
      }
    }
    return new Response('Unauthorized', { status: 401 });
  }
  return next(req);
}`;

const DEMO_TEST_CODE = `describe('authMiddleware', () => {
  it('refreshes an expired token silently', async () => {
    const expiredToken = createExpiredJWT(mockUser);
    const validRefresh = createRefreshToken(mockUser);

    const req = mockRequest({
      authorization: \`Bearer \${expiredToken}\`,
      cookies: { refreshToken: validRefresh },
    });

    const res = await authMiddleware(req);

    expect(res.status).toBe(200);
    expect(req.user.id).toBe(mockUser.id);
    expect(req.newAccessToken).toBeDefined();
  });
});`;

function ArtifactCard({
  title,
  onOpen,
}: {
  title: string;
  onOpen: () => void;
}) {
  return (
    <ClickableCard
      label={`Open ${title}`}
      onClick={onOpen}
      variant="muted"
      padding={3}
      maxWidth={360}
    >
      <HStack gap={3} vAlign="center" width="100%">
        <Icon icon={DocumentIcon} size="md" color="secondary" />
        <StackItem size="fill">
          <VStack gap={0}>
            <Text type="label" weight="semibold" maxLines={1}>
              {title}
            </Text>
            <Text type="supporting" color="secondary">
              Document
            </Text>
          </VStack>
        </StackItem>
        <Icon
          icon={ChevronRightIcon}
          size="sm"
          color="secondary"
          xstyle={rtlStyles.mirror}
        />
      </HStack>
    </ClickableCard>
  );
}

function FullAIChatExchange({
  timestamp,
  onOpenArtifact,
}: {
  timestamp: string;
  onOpenArtifact: () => void;
}) {
  return (
    <>
      {/* User message 1: mention + file attachments */}
      <ChatMessage sender="user">
        <HStack gap={1} wrap="wrap">
          <Token label="auth-service.ts" />
          <Token label="middleware.ts" />
        </HStack>
        <ChatMessageBubble
          metadata={
            <ChatMessageMetadata
              timestamp={<Timestamp value={timestamp} format="time" />}
            />
          }
        >
          <ChatTokenizedText tokens={MENTION_TOKENS}>
            @agent Can you review these auth files? The JWT refresh logic seems
            broken — tokens expire but the middleware doesn&apos;t catch it.
          </ChatTokenizedText>
        </ChatMessageBubble>
      </ChatMessage>

      {/* Assistant message 1: tool calls, markdown, code block */}
      <ChatMessage
        sender="assistant"
        avatar={<Avatar name="Agent" size="md" />}
      >
        <ChatMessageBubble variant="ghost">
          Looking into the auth files now. Let me read through the code and
          trace the token refresh flow.
        </ChatMessageBubble>
        <ChatToolCalls
          defaultIsExpanded
          calls={[
            {
              name: "read",
              target: "auth-service.ts",
              status: "complete",
              duration: "45ms",
            },
            {
              name: "read",
              target: "middleware.ts",
              status: "complete",
              duration: "38ms",
            },
            {
              name: "bash",
              target: 'grep -rn "refreshToken" src/',
              status: "complete",
              duration: "120ms",
              node: "cli:remote-server",
            },
          ]}
        />

        <ChatMessageBubble variant="ghost">
          <Markdown density="compact">{`Found the issue. In \`middleware.ts\`, the token validation runs **before** the refresh check. When a token expires, the middleware rejects the request immediately instead of attempting a refresh.

Here's the problematic sequence:

1. Request arrives with an expired access token
2. \`validateToken()\` throws \`TokenExpiredError\`
3. The catch block returns \`401\` — never reaching \`refreshToken()\`

The fix is to catch \`TokenExpiredError\` specifically and attempt a refresh before rejecting:`}</Markdown>
        </ChatMessageBubble>

        <ChatMessageBubble variant="ghost">
          <CodeBlock
            title="middleware.ts"
            language="typescript"
            code={DEMO_MIDDLEWARE_CODE}
          />
        </ChatMessageBubble>

        <ChatToolCalls
          calls={[
            {
              name: "edit",
              target: "middleware.ts",
              status: "complete",
              duration: "85ms",
              additions: 8,
              deletions: 2,
            },
          ]}
        />

        <ChatMessageMetadata
          timestamp={<Timestamp value={timestamp} format="time" />}
          footer={
            <Text type="supporting" color="secondary">
              Agent
            </Text>
          }
        />
      </ChatMessage>

      {/* User message 2: multi-bubble grouping */}
      <ChatMessage sender="user">
        <ChatMessageBubble group="first">
          Nice catch, that makes sense
        </ChatMessageBubble>
        <ChatMessageBubble
          group="last"
          metadata={
            <ChatMessageMetadata
              timestamp={<Timestamp value={timestamp} format="time" />}
              status="delivered"
            />
          }
        >
          Can you also add a test for the refresh path?
        </ChatMessageBubble>
      </ChatMessage>

      {/* Assistant message 2: test results table + code block */}
      <ChatMessage
        sender="assistant"
        avatar={<Avatar name="Agent" size="md" />}
      >
        <ChatToolCalls
          defaultIsExpanded
          calls={[
            {
              name: "read",
              target: "middleware.test.ts",
              status: "complete",
              duration: "32ms",
            },
            {
              name: "edit",
              target: "middleware.test.ts",
              status: "complete",
              duration: "110ms",
              additions: 24,
              deletions: 0,
            },
            {
              name: "bash",
              target: "yarn test middleware",
              status: "complete",
              duration: "3.2s",
              node: "cli:remote-server",
            },
          ]}
        />
        <ChatMessageBubble variant="ghost">
          <Markdown density="compact">{`Added a test for the refresh flow. All **4 tests** pass:

| Test | Status |
|------|--------|
| Valid token passes through | ✅ |
| Expired token triggers refresh | ✅ |
| Expired token with invalid refresh returns 401 | ✅ |
| Malformed token returns 401 immediately | ✅ |`}</Markdown>
        </ChatMessageBubble>

        <ChatMessageBubble variant="ghost">
          <CodeBlock
            title="middleware.test.ts"
            language="typescript"
            code={DEMO_TEST_CODE}
          />
        </ChatMessageBubble>
        <ChatMessageMetadata
          timestamp={<Timestamp value={timestamp} format="time" />}
        />
      </ChatMessage>

      {/* Status message */}
      <ChatSystemMessage>Changes saved to workspace</ChatSystemMessage>

      {/* User message 3: requests a document artifact */}
      <ChatMessage sender="user">
        <ChatMessageBubble
          metadata={
            <ChatMessageMetadata
              timestamp={<Timestamp value={timestamp} format="time" />}
            />
          }
        >
          Looks solid. Before I open the PR, can you write up a short design doc
          explaining the token-refresh flow for the team?
        </ChatMessageBubble>
      </ChatMessage>

      {/* Assistant message 3: artifact card */}
      <ChatMessage
        sender="assistant"
        avatar={<Avatar name="Agent" size="md" />}
      >
        <ChatMessageBubble variant="ghost">
          <Markdown density="compact">
            {`I've drafted a design doc covering the problem, the fix, and the test matrix — pulling straight from the changes we just made.\n\nOpen the document below to review it. Want me to expand any section?`}
          </Markdown>
        </ChatMessageBubble>
        <ChatMessageBubble
          variant="ghost"
          width="100%"
          metadata={
            <ChatMessageMetadata
              timestamp={<Timestamp value={timestamp} format="time" />}
            />
          }
        >
          <ArtifactCard title={ARTIFACT_TITLE} onOpen={onOpenArtifact} />
        </ChatMessageBubble>
      </ChatMessage>

      {/* User follow-up */}
      <ChatMessage sender="user">
        <ChatMessageBubble
          metadata={
            <ChatMessageMetadata
              timestamp={<Timestamp value={timestamp} format="time" />}
              status="delivered"
            />
          }
        >
          This is great. Can you add a section on rollout and monitoring at the
          end?
        </ChatMessageBubble>
      </ChatMessage>

      {/* Assistant message 4: in-progress tool call */}
      <ChatMessage
        sender="assistant"
        avatar={<Avatar name="Agent" size="md" />}
      >
        <ChatMessageBubble variant="ghost">
          <Markdown density="compact">
            {`On it — adding a **Rollout & Monitoring** section with a staged flag ramp and the alert thresholds. Updating the document now.`}
          </Markdown>
        </ChatMessageBubble>
        <ChatToolCalls
          calls={[
            {
              name: "edit",
              target: "docs/token-refresh.md",
              status: "running",
              node: "cli:remote-server",
            },
          ]}
        />
        <ChatMessageMetadata
          timestamp={<Timestamp value={timestamp} format="time" />}
        />
      </ChatMessage>
    </>
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
  const [sending, setSending] = useState(false);
  const [creatingSession, setCreatingSession] = useState(false);
  const [tabRequest, setTabRequest] = useState<WorkspaceTabRequest | null>(
    null
  );
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
  const tabRequestNonceRef = useRef(0);

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

    const pinToBottom = () => {
      const target = el.scrollHeight - el.clientHeight;
      if (target > 0 && el.scrollTop !== target) {
        el.scrollTop = target;
      }
    };

    pinToBottom();

    let stopped = false;
    let settleTimer: ReturnType<typeof setTimeout> | null = null;

    const stopPinning = () => {
      if (stopped) return;
      stopped = true;
      if (settleTimer) {
        clearTimeout(settleTimer);
        settleTimer = null;
      }
      observer?.disconnect();
      el.removeEventListener("wheel", stopPinning);
      el.removeEventListener("touchstart", stopPinning);
      el.removeEventListener("pointerdown", stopPinning);
      el.removeEventListener("keydown", stopPinning);
    };

    const observer =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(() => {
            if (!stopped) pinToBottom();
          })
        : null;

    if (observer) {
      observer.observe(el);
      if (el.firstElementChild) {
        observer.observe(el.firstElementChild);
      }
    }

    el.addEventListener("wheel", stopPinning, { passive: true });
    el.addEventListener("touchstart", stopPinning, { passive: true });
    el.addEventListener("pointerdown", stopPinning, { passive: true });
    el.addEventListener("keydown", stopPinning);

    const scheduleStop = () => {
      if (stopped) return;
      if (settleTimer) clearTimeout(settleTimer);
      settleTimer = setTimeout(stopPinning, 350);
    };

    if (document.fonts?.ready) {
      void document.fonts.ready.then(() => {
        if (!stopped) {
          pinToBottom();
          scheduleStop();
        }
      });
    }
    settleTimer = setTimeout(stopPinning, 1200);

    return stopPinning;
  }, [session.id]);

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

  function openPanel(preferredTab?: WorkspacePanelTab) {
    if (preferredTab) {
      tabRequestNonceRef.current += 1;
      setTabRequest({ tab: preferredTab, nonce: tabRequestNonceRef.current });
    }
    const width = rootRef.current?.offsetWidth ?? Infinity;
    if (width <= MOBILE_MAX_WIDTH) {
      setIsMobileDialogOpen(true);
    }
  }

  function toggleChatPanel() {
    const width = rootRef.current?.offsetWidth ?? Infinity;
    if (width <= MOBILE_MAX_WIDTH) {
      setIsMobileDialogOpen((open) => !open);
    } else {
      setDesktopChatOpen(!isChatOpen);
    }
  }

  async function handleSend(value: string): Promise<boolean> {
    const content = value.trim();
    if (!content || sending) return false;

    setSending(true);
    try {
      const { session: updated } = await apiClient.sendMessage(
        session.id,
        content
      );
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
      return true;
    } catch (error) {
      toast({
        body: error instanceof Error ? error.message : "发送消息失败",
        type: "error",
        uniqueID: "send-message-err",
      });
      return false;
    } finally {
      setSending(false);
    }
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
                  emptyState={
                    <EmptyState
                      title="开始新会话"
                      description="在下方输入框发送消息，开启当前 Project 的新对话"
                    />
                  }
                  composer={
                    <AgentChatComposer
                      onSubmit={handleSend}
                      isDisabled={sending}
                      models={initialModels}
                      selectedModelId={selectedModelId}
                      onSelectModel={setSelectedModelId}
                    />
                  }
                >
                  {session.messages.length > 0 && (
                    <ChatMessageList>
                      <ChatSystemMessage variant="divider">
                        Today
                      </ChatSystemMessage>

                      {session.messages.map((message) => (
                        <Fragment key={message.id}>
                          {message.role === "user" ? (
                            <ChatMessage sender="user">
                              <ChatMessageBubble
                                metadata={
                                  <ChatMessageMetadata
                                    timestamp={
                                      <Timestamp
                                        value={message.createdAt}
                                        format="time"
                                      />
                                    }
                                    status="delivered"
                                  />
                                }
                              >
                                {message.content}
                              </ChatMessageBubble>
                            </ChatMessage>
                          ) : (
                            <FullAIChatExchange
                              timestamp={message.createdAt}
                              onOpenArtifact={() => openPanel("preview")}
                            />
                          )}
                        </Fragment>
                      ))}
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
                  title={session.title}
                  projectName={activeProjectName}
                  files={session.files}
                  tabRequest={tabRequest}
                  initialTabs={initialWorkspaceTabs}
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
                title={session.title}
                projectName={activeProjectName}
                files={session.files}
                tabRequest={tabRequest}
                initialTabs={initialWorkspaceTabs}
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
