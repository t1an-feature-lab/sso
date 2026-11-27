"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { Button } from "@astryxdesign/core/Button";
import { CodeBlock } from "@astryxdesign/core/CodeBlock";
import { Dialog, DialogHeader } from "@astryxdesign/core/Dialog";
import { DropdownMenu } from "@astryxdesign/core/DropdownMenu";
import { EmptyState } from "@astryxdesign/core/EmptyState";
import { Icon } from "@astryxdesign/core/Icon";
import {
  HStack,
  Layout,
  LayoutContent,
  LayoutFooter,
  LayoutPanel,
  Stack,
  StackItem,
  VStack,
} from "@astryxdesign/core/Layout";
import { MoreMenu } from "@astryxdesign/core/MoreMenu";
import { ResizeHandle, useResizable } from "@astryxdesign/core/Resizable";
import { StatusDot } from "@astryxdesign/core/StatusDot";
import { Text } from "@astryxdesign/core/Text";
import { TextInput } from "@astryxdesign/core/TextInput";
import { TreeList, type TreeListItemData } from "@astryxdesign/core/TreeList";
import { useClipboard } from "@astryxdesign/core/hooks";
import {
  ArrowDownTrayIcon,
  ArrowPathIcon,
  ArrowTopRightOnSquareIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CircleStackIcon,
  ClipboardDocumentIcon,
  CodeBracketIcon,
  Cog6ToothIcon,
  CommandLineIcon,
  DevicePhoneMobileIcon,
  DocumentTextIcon,
  EyeIcon,
  FolderIcon,
  MagnifyingGlassIcon,
  PlusIcon,
  PowerIcon,
  RocketLaunchIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { useAppToast } from "@/components/app-toast";
import { WorkspaceSettingsPanel } from "@/components/workspace-settings-panel";
import {
  DEFAULT_PERSISTED_TABS,
  parseWorkspaceTabsCookie,
  readWorkspaceTabsRawFromDocument,
  writeWorkspaceTabsCookie,
  type PersistedWorkspaceTabs,
  type WorkspacePanelTab,
  type WorkspaceTabInstance,
} from "@/lib/workspace-tabs-prefs";
import { apiClient } from "@/lib/api-client";
import { overlayScrollbarMarkup } from "@/lib/overlay-scrollbar";
import { WorkspaceFileTree } from "@/components/workspace-file-tree";
import { createZipBlob } from "@/lib/zip";
import type { ProjectFile } from "@/lib/types";
import "./ide-preview-panel.css";

export type { PersistedWorkspaceTabs, WorkspacePanelTab };

export interface WorkspaceTabRequest {
  tab: WorkspacePanelTab;
  nonce: number;
}

const TAB_META: Record<
  WorkspacePanelTab,
  { label: string; icon: typeof EyeIcon }
> = {
  preview: { label: "Preview", icon: EyeIcon },
  code: { label: "Code", icon: CodeBracketIcon },
  database: { label: "Database", icon: CircleStackIcon },
  terminal: { label: "Terminal", icon: CommandLineIcon },
  settings: { label: "Settings", icon: Cog6ToothIcon },
};

const ADDABLE_TABS: WorkspacePanelTab[] = [
  "preview",
  "code",
  "database",
  "terminal",
  "settings",
];

const tabsStoreListeners = new Set<() => void>();
let tabsSnapshotCache: {
  raw: string | null;
  state: PersistedWorkspaceTabs;
} | null = null;

function readPersistedTabs(
  fallback: PersistedWorkspaceTabs
): PersistedWorkspaceTabs {
  if (typeof document === "undefined") {
    return fallback;
  }
  const raw = readWorkspaceTabsRawFromDocument();
  if (raw === null) {
    return fallback;
  }
  if (tabsSnapshotCache && tabsSnapshotCache.raw === raw) {
    return tabsSnapshotCache.state;
  }
  const state = parseWorkspaceTabsCookie(raw);
  tabsSnapshotCache = { raw, state };
  return state;
}

function emitTabsStore() {
  for (const listener of tabsStoreListeners) {
    listener();
  }
}

function writePersistedTabs(
  fallback: PersistedWorkspaceTabs,
  updater: (prev: PersistedWorkspaceTabs) => PersistedWorkspaceTabs
) {
  if (typeof document === "undefined") return;
  const current = readPersistedTabs(fallback);
  const next = updater(current);
  const raw = writeWorkspaceTabsCookie(next);
  tabsSnapshotCache = { raw, state: next };
  emitTabsStore();
}

function subscribePersistedTabs(listener: () => void) {
  tabsStoreListeners.add(listener);
  return () => {
    tabsStoreListeners.delete(listener);
  };
}

function getTabLabel(tab: WorkspaceTabInstance): string {
  const base = TAB_META[tab.type].label;
  if (tab.type === "preview" || tab.index <= 1) {
    return base;
  }
  return `${base} ${tab.index}`;
}

const styles: Record<string, CSSProperties> = {
  root: {
    display: "flex",
    flexDirection: "column",
    height: "100%",
    minHeight: 0,
    width: "100%",
  },
  body: {
    flex: 1,
    minHeight: 0,
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
  },
  emptyCenter: {
    flex: 1,
    minHeight: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  fileExplorer: {
    padding: 12,
    minWidth: 0,
    height: "100%",
    minHeight: 0,
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
  },
  editorArea: {
    overflow: "auto",
    minHeight: 0,
    position: "relative",
  },
  previewFrame: {
    flex: 1,
    width: "100%",
    minHeight: 0,
    border: 0,
    backgroundColor: "var(--color-surface-default)",
  },
  scrollContainer: {
    flex: 1,
    minHeight: 0,
    overflowY: "auto",
    padding: 16,
  },
};

function buildTreeFromFiles(
  files: ProjectFile[],
  search: string,
  onSelect: (path: string) => void
): TreeListItemData[] {
  const normalized = search.trim().toLowerCase();
  const filtered = normalized
    ? files.filter((file) => file.path.toLowerCase().includes(normalized))
    : files;

  const rootFiles: TreeListItemData[] = [];
  const folderMap = new Map<string, TreeListItemData[]>();

  for (const file of filtered) {
    const parts = file.path.split("/");
    const fileName = parts[parts.length - 1] ?? file.path;
    const item: TreeListItemData = {
      id: file.path,
      label: <Text maxLines={1}>{fileName}</Text>,
      startContent: <Icon icon={DocumentTextIcon} size="xsm" />,
      onClick: () => onSelect(file.path),
    };

    if (parts.length === 1) {
      rootFiles.push(item);
    } else {
      const folder = parts[0];
      const existing = folderMap.get(folder) ?? [];
      existing.push(item);
      folderMap.set(folder, existing);
    }
  }

  const folders: TreeListItemData[] = Array.from(folderMap.entries()).map(
    ([folder, children]) => ({
      id: `folder:${folder}`,
      label: <Text maxLines={1}>{folder}</Text>,
      startContent: <Icon icon={FolderIcon} size="xsm" />,
      isExpanded: true,
      children,
    })
  );

  return [...folders, ...rootFiles];
}

function buildPreviewHtml(files: ProjectFile[]): string {
  const htmlFile =
    files.find((file) => file.path.endsWith(".html")) ?? files[0];
  const cssFile = files.find((file) => file.path.endsWith(".css"));
  const jsFile = files.find(
    (file) => file.path.endsWith(".js") || file.path.endsWith(".mjs")
  );

  if (!htmlFile) {
    return "";
  }

  let doc = htmlFile.content;
  if (cssFile) {
    const inlineCss = `<style>${cssFile.content}</style>`;
    if (doc.includes('href="styles.css"')) {
      doc = doc.replace(/<link[^>]*href="styles\.css"[^>]*>/i, inlineCss);
    } else if (doc.includes("</head>")) {
      doc = doc.replace("</head>", `${inlineCss}</head>`);
    } else {
      doc = `${inlineCss}${doc}`;
    }
  }

  if (jsFile) {
    const inlineJs = `<script>${jsFile.content}</script>`;
    if (doc.includes('src="app.js"')) {
      doc = doc.replace(/<script[^>]*src="app\.js"[^>]*><\/script>/i, inlineJs);
    } else if (doc.includes("</body>")) {
      doc = doc.replace("</body>", `${inlineJs}</body>`);
    } else {
      doc = `${doc}${inlineJs}`;
    }
  }

  const scrollFix = overlayScrollbarMarkup();
  if (doc.includes("</head>")) {
    return doc.replace("</head>", `${scrollFix}</head>`);
  }
  return `${scrollFix}${doc}`;
}

function splitPreviewTarget(value: string | null | undefined): {
  origin: string | null;
  path: string;
} {
  if (!value || !/^https?:\/\//i.test(value)) {
    return { origin: null, path: "/" };
  }
  try {
    const url = new URL(value);
    return {
      origin: url.origin,
      path: `${url.pathname}${url.search}${url.hash}` || "/",
    };
  } catch {
    return { origin: null, path: "/" };
  }
}

function normalizePreviewPath(input: string, origin: string | null): string {
  const trimmed = input.trim();
  if (!trimmed) return "/";
  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const url = new URL(trimmed);
      return `${url.pathname}${url.search}${url.hash}` || "/";
    } catch {
      return "/";
    }
  }
  const withSlash = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  if (withSlash.startsWith("//")) return "/";
  if (!origin) return withSlash;
  try {
    const url = new URL(withSlash, origin);
    if (url.origin !== origin) return "/";
    return `${url.pathname}${url.search}${url.hash}` || "/";
  } catch {
    return "/";
  }
}

function toSafeSlug(text: string): string {
  const ascii = text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return ascii || "agent-app";
}

export function IdePreviewPanel({
  storageScopeKey,
  projectId,
  title,
  projectName,
  files,
  devServerUrl,
  tabRequest,
  initialTabs = DEFAULT_PERSISTED_TABS,
  leadingAction,
  onWorkspaceChange,
}: {
  storageScopeKey?: string;
  projectId?: string | null;
  title: string;
  projectName?: string | null;
  files: ProjectFile[];
  devServerUrl?: string | null;
  tabRequest?: WorkspaceTabRequest | null;
  initialTabs?: PersistedWorkspaceTabs;
  leadingAction?: ReactNode;
  onWorkspaceChange?: (update: {
    files: ProjectFile[];
    previewUrl: string | null;
  }) => void;
}) {
  const toast = useAppToast();
  const { copy } = useClipboard({ announce: "已复制" });

  const getSnapshot = useCallback(
    () => readPersistedTabs(initialTabs),
    [initialTabs]
  );
  const getServerSnapshot = useCallback(() => initialTabs, [initialTabs]);
  const persistedTabs = useSyncExternalStore(
    subscribePersistedTabs,
    getSnapshot,
    getServerSnapshot
  );

  const { openTabs, activeTabId } = persistedTabs;

  const [selectedPathByTab, setSelectedPathByTab] = useState<
    Record<string, string>
  >({});
  const [fileQueryByTab, setFileQueryByTab] = useState<Record<string, string>>(
    {}
  );
  const [previewBoot] = useState(() => splitPreviewTarget(devServerUrl));
  const [previewKey, setPreviewKey] = useState(0);
  const [previewOrigin, setPreviewOrigin] = useState<string | null>(
    previewBoot.origin
  );
  const [previewPath, setPreviewPath] = useState(previewBoot.path);
  const [pathDraft, setPathDraft] = useState(previewBoot.path);
  const [pathHistory, setPathHistory] = useState<string[]>([previewBoot.path]);
  const [pathIndex, setPathIndex] = useState(0);
  const [viewport, setViewport] = useState<"desktop" | "mobile">("desktop");
  const [frameOrigin, setFrameOrigin] = useState<string | null>(null);
  const [serverPhase, setServerPhase] = useState<
    "running" | "stopped" | "starting" | "stopping"
  >(previewBoot.origin ? "running" : "stopped");
  const [terminalRunning, setTerminalRunning] = useState(false);
  const serverPhaseRef = useRef(serverPhase);
  serverPhaseRef.current = serverPhase;
  const previewOriginRef = useRef(previewOrigin);
  previewOriginRef.current = previewOrigin;
  const seenLiveRef = useRef(previewBoot.origin !== null);
  const previewEpoch = useRef(0);
  const filesRef = useRef(files);
  filesRef.current = files;
  const onWorkspaceChangeRef = useRef(onWorkspaceChange);
  onWorkspaceChangeRef.current = onWorkspaceChange;
  const devServerUrlRef = useRef(devServerUrl);
  devServerUrlRef.current = devServerUrl;

  useEffect(() => {
    previewEpoch.current += 1;
    const next = splitPreviewTarget(devServerUrl);
    if (!next.origin) {
      if (
        serverPhaseRef.current === "starting" ||
        serverPhaseRef.current === "stopping"
      ) {
        return;
      }
      setPreviewOrigin(null);
      setServerPhase("stopped");
      return;
    }
    const originChanged = previewOriginRef.current !== next.origin;
    seenLiveRef.current = true;
    setPreviewOrigin(next.origin);
    setServerPhase("running");
    if (!originChanged) return;
    setPreviewPath("/");
    setPathDraft("/");
    setPathHistory(["/"]);
    setPathIndex(0);
    setPreviewKey((key) => key + 1);
  }, [devServerUrl]);

  // Per-terminal tab state
  const [terminalInputByTab, setTerminalInputByTab] = useState<
    Record<string, string>
  >({});
  const [terminalEntriesByTab, setTerminalEntriesByTab] = useState<
    Record<string, string[]>
  >({});
  const terminalOutputRef = useRef<HTMLPreElement>(null);

  // Publish dialog & Settings tab state
  const [publishOpen, setPublishOpen] = useState(false);
  const [publishSlug, setPublishSlug] = useState(() =>
    toSafeSlug(projectName ?? title)
  );
  const [publishing, setPublishing] = useState(false);

  const workspaceSlug = toSafeSlug(projectName ?? title);

  const lastHandledRequestNonceRef = useRef<number | null>(null);

  const activeTabInstance = useMemo(
    () => openTabs.find((item) => item.id === activeTabId) ?? null,
    [openTabs, activeTabId]
  );

  useEffect(() => {
    if (!projectId || activeTabInstance?.type !== "preview") return;
    const epoch = previewEpoch.current;
    let cancelled = false;
    apiClient
      .getPreviewServer(projectId)
      .then((status) => {
        if (cancelled || epoch !== previewEpoch.current) return;
        if (
          serverPhaseRef.current === "starting" ||
          serverPhaseRef.current === "stopping"
        ) {
          return;
        }
        if (status.running && status.previewUrl) {
          const next = splitPreviewTarget(status.previewUrl);
          seenLiveRef.current = true;
          setPreviewOrigin(next.origin);
          setServerPhase("running");
          if (status.previewUrl !== devServerUrlRef.current) {
            onWorkspaceChangeRef.current?.({
              files: filesRef.current,
              previewUrl: status.previewUrl,
            });
          }
          return;
        }
        setPreviewOrigin(null);
        setServerPhase("stopped");
        if (devServerUrlRef.current) {
          onWorkspaceChangeRef.current?.({
            files: filesRef.current,
            previewUrl: null,
          });
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [projectId, activeTabInstance?.type]);

  useEffect(() => {
    if (!projectId || !previewOrigin || serverPhase !== "running") {
      setFrameOrigin(null);
      return;
    }
    let cancelled = false;
    apiClient
      .ensurePreviewFrame(projectId, previewOrigin)
      .then(async (result) => {
        if (cancelled) return;
        try {
          await fetch(`${result.origin}/__ab_overlay.js`, {
            mode: "no-cors",
            cache: "no-store",
          });
          if (!cancelled) setFrameOrigin(result.origin);
        } catch {
          if (!cancelled) setFrameOrigin(previewOrigin);
        }
      })
      .catch(() => {
        if (!cancelled) setFrameOrigin(previewOrigin);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId, previewOrigin, serverPhase]);

  const liveFrameOrigin = projectId ? frameOrigin : previewOrigin;

  const hasPreviewTab = useMemo(
    () => openTabs.some((tab) => tab.type === "preview"),
    [openTabs]
  );

  const addableMenuTabs = useMemo(
    () => ADDABLE_TABS.filter((tab) => tab !== "preview" || !hasPreviewTab),
    [hasPreviewTab]
  );

  const openOrFocusTab = useCallback(
    (type: WorkspacePanelTab, focusExisting: boolean) => {
      writePersistedTabs(initialTabs, (prev) => {
        if (type === "preview" || focusExisting) {
          const existing = prev.openTabs.find((item) => item.type === type);
          if (existing) {
            return { ...prev, activeTabId: existing.id };
          }
        }

        if (type === "preview") {
          const created: WorkspaceTabInstance = {
            id: "preview-1",
            type: "preview",
            index: 1,
          };
          return {
            ...prev,
            openTabs: [created, ...prev.openTabs],
            activeTabId: created.id,
          };
        }

        const nextIndex = (prev.counters[type] ?? 0) + 1;
        const created: WorkspaceTabInstance = {
          id: `${type}-${nextIndex}`,
          type,
          index: nextIndex,
        };
        return {
          openTabs: [...prev.openTabs, created],
          activeTabId: created.id,
          counters: {
            ...prev.counters,
            [type]: nextIndex,
          },
        };
      });
    },
    [initialTabs]
  );

  // Sync external tab requests (e.g. clicking an ArtifactCard -> open/focus Preview)
  useEffect(() => {
    if (!tabRequest) return;
    if (lastHandledRequestNonceRef.current === tabRequest.nonce) return;
    lastHandledRequestNonceRef.current = tabRequest.nonce;
    openOrFocusTab(tabRequest.tab, true);
  }, [tabRequest, openOrFocusTab]);

  const currentTabId = activeTabInstance?.id ?? "";
  const selectedPath = selectedPathByTab[currentTabId] ?? "";
  const fileQuery = fileQueryByTab[currentTabId] ?? "";
  const [openedByPath, setOpenedByPath] = useState<Record<string, ProjectFile>>(
    {}
  );
  const fileTreeRevision = useMemo(
    () => files.map((file) => file.path).join("\n"),
    [files]
  );
  const terminalInput = terminalInputByTab[currentTabId] ?? "";
  const defaultTerminalBanner = useMemo(
    () => ["工作空间终端已连接到当前 Project\n"],
    []
  );
  const terminalEntries =
    terminalEntriesByTab[currentTabId] ?? defaultTerminalBanner;

  const activeFile = useMemo(() => {
    if (selectedPath && openedByPath[selectedPath]) {
      return openedByPath[selectedPath];
    }
    return files.find((file) => file.path === selectedPath) ?? null;
  }, [files, openedByPath, selectedPath]);

  const fileTree = useMemo(
    () =>
      buildTreeFromFiles(files, fileQuery, (path) => {
        if (!currentTabId) return;
        setSelectedPathByTab((prev) => ({ ...prev, [currentTabId]: path }));
      }),
    [files, fileQuery, currentTabId]
  );

  const previewDoc = useMemo(() => buildPreviewHtml(files), [files]);

  const explorerPanel = useResizable({
    defaultSize: 196,
    minSize: 140,
    maxSize: 300,
    collapsible: true,
    collapsedSize: 40,
  });

  useEffect(() => {
    if (terminalOutputRef.current) {
      terminalOutputRef.current.scrollTop =
        terminalOutputRef.current.scrollHeight;
    }
  }, [terminalEntries, currentTabId]);

  function commitPreviewPath(raw: string) {
    const next = normalizePreviewPath(raw, previewOrigin);
    const base = pathHistory.slice(0, pathIndex + 1);
    const history = base[base.length - 1] === next ? base : [...base, next];
    setPathDraft(next);
    setPreviewPath(next);
    setPathHistory(history);
    setPathIndex(history.length - 1);
    if (next !== previewPath) setPreviewKey((key) => key + 1);
  }

  function travelPreview(nextIndex: number) {
    const next = pathHistory[nextIndex];
    if (!next) return;
    setPathIndex(nextIndex);
    setPreviewPath(next);
    setPathDraft(next);
    setPreviewKey((key) => key + 1);
  }

  function openPreviewExternal() {
    if (!previewOrigin || serverPhase !== "running") return;
    const path = normalizePreviewPath(previewPath, previewOrigin);
    window.open(`${previewOrigin}${path}`, "_blank", "noopener,noreferrer");
  }

  async function togglePreviewServer() {
    if (!projectId || serverPhase === "starting" || serverPhase === "stopping") {
      return;
    }
    const action = serverPhase === "running" ? "stop" : "start";
    previewEpoch.current += 1;
    setServerPhase(action === "start" ? "starting" : "stopping");
    try {
      const status = await apiClient.controlPreviewServer(projectId, action);
      const next = splitPreviewTarget(status.previewUrl);
      if (status.running) seenLiveRef.current = true;
      setPreviewOrigin(next.origin);
      setServerPhase(status.running ? "running" : "stopped");
      if (status.running) {
        setPreviewPath("/");
        setPathDraft("/");
        setPathHistory(["/"]);
        setPathIndex(0);
        setPreviewKey((key) => key + 1);
      }
      onWorkspaceChange?.({ files, previewUrl: status.previewUrl });
    } catch (error) {
      setServerPhase(action === "start" ? "stopped" : "running");
      toast({
        body: error instanceof Error ? error.message : "预览服务操作失败",
        type: "error",
        uniqueID: "preview-server",
      });
    }
  }

  function handleActivateTab(tab: WorkspaceTabInstance) {
    writePersistedTabs(initialTabs, (prev) => ({
      ...prev,
      activeTabId: tab.id,
    }));
  }

  function handleOpenTab(type: WorkspacePanelTab) {
    openOrFocusTab(type, type === "preview");
  }

  function handleOpenSettingsTab() {
    openOrFocusTab("settings", true);
  }

  function handleCloseTab(tabId: string) {
    writePersistedTabs(initialTabs, (prev) => {
      const closedIndex = prev.openTabs.findIndex((item) => item.id === tabId);
      if (closedIndex === -1) return prev;
      const nextTabs = prev.openTabs.filter((item) => item.id !== tabId);
      const nextActiveTabId =
        prev.activeTabId === tabId
          ? nextTabs[Math.min(closedIndex, nextTabs.length - 1)]?.id ?? null
          : prev.activeTabId;
      return {
        ...prev,
        openTabs: nextTabs,
        activeTabId: nextActiveTabId,
      };
    });
  }

  async function handleCopyActiveFile() {
    if (!activeFile) return;
    const ok = await copy(activeFile.content);
    toast({
      body: ok ? `已复制 ${activeFile.path}` : "复制失败",
      type: ok ? "success" : "error",
      uniqueID: "copy-file",
    });
  }

  function handleDownloadZip() {
    if (files.length === 0) {
      toast({
        body: "暂无可下载的代码文件",
        type: "info",
        uniqueID: "download-zip-empty",
      });
      return;
    }

    const blob = createZipBlob(files);
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${toSafeSlug(projectName ?? title)}.zip`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    toast({
      body: "已开始下载 ZIP",
      uniqueID: "download-zip-ok",
    });
  }

  function handleConfirmPublish() {
    if (publishing) return;
    setPublishing(true);
    setTimeout(() => {
      setPublishing(false);
      setPublishOpen(false);
      toast({
        body: `已发布至 ${publishSlug || "agent-app"}.workspace.local`,
        uniqueID: "publish-app-ok",
      });
    }, 350);
  }

  async function handleRunTerminalCommand() {
    if (!currentTabId || terminalRunning) return;
    const cmd = terminalInput.trim();
    setTerminalInputByTab((prev) => ({ ...prev, [currentTabId]: "" }));
    if (!cmd) return;

    if (cmd === "clear") {
      setTerminalEntriesByTab((prev) => ({ ...prev, [currentTabId]: [] }));
      return;
    }

    const tabId = currentTabId;
    const appendEntry = (entry: string) => {
      setTerminalEntriesByTab((prev) => ({
        ...prev,
        [tabId]: [...(prev[tabId] ?? defaultTerminalBanner), entry],
      }));
    };

    if (!projectId) {
      appendEntry(`$ ${cmd}\n当前会话没有 Project\n`);
      return;
    }

    appendEntry(`$ ${cmd}\n`);
    setTerminalRunning(true);
    try {
      const { result, files: nextFiles, previewUrl } =
        await apiClient.runProjectCommand(projectId, cmd);
      const output =
        result.output.trim() ||
        (result.status === "running" ? "进程已在后台运行" : "");
      if (output) appendEntry(`${output}\n`);
      onWorkspaceChange?.({ files: nextFiles, previewUrl });
    } catch (error) {
      appendEntry(
        `${error instanceof Error ? error.message : "命令执行失败"}\n`
      );
    } finally {
      setTerminalRunning(false);
    }
  }

  function handleTerminalKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      handleRunTerminalCommand();
    }
  }

  return (
    <div className="v0-workspace" style={styles.root}>
      <div className="v0-header-bar" role="toolbar" aria-label="工作空间标签栏">
        <div className="v0-header-start">
          {leadingAction}
          <div className="v0-tab-strip" role="tablist" aria-label="工作空间标签">
            {openTabs.map((tab) => {
              const meta = TAB_META[tab.type];
              const tabLabel = getTabLabel(tab);
              const isActive = activeTabInstance?.id === tab.id;
              return (
                <div
                  key={tab.id}
                  role="tab"
                  tabIndex={0}
                  aria-selected={isActive}
                  data-active={isActive ? "true" : "false"}
                  className="v0-tab-pill"
                  onClick={() => handleActivateTab(tab)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      handleActivateTab(tab);
                    }
                  }}
                >
                  {tab.type === "preview" ? (
                    <StatusDot
                      variant={
                        serverPhase === "running" || (!projectId && files.length > 0)
                          ? "success"
                          : "neutral"
                      }
                      label={
                        serverPhase === "running"
                          ? "运行中"
                          : !projectId && files.length > 0
                            ? "预览就绪"
                            : "未运行"
                      }
                    />
                  ) : (
                    <Icon icon={meta.icon} size="sm" />
                  )}
                  <span>{tabLabel}</span>
                  <button
                    type="button"
                    className="v0-tab-close"
                    aria-label={`关闭 ${tabLabel}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      handleCloseTab(tab.id);
                    }}
                  >
                    <Icon icon={XMarkIcon} size="xsm" />
                  </button>
                </div>
              );
            })}
          </div>

          <DropdownMenu
            button={{
              label: "新增标签页",
              variant: "ghost",
              size: "sm",
              icon: <Icon icon={PlusIcon} size="sm" />,
              isIconOnly: true,
            }}
            hasChevron={false}
            menuWidth={180}
            items={addableMenuTabs.map((tab) => ({
              id: tab,
              label: TAB_META[tab].label,
              icon: TAB_META[tab].icon,
              onClick: () => handleOpenTab(tab),
            }))}
          />
        </div>

        <div className="v0-header-end">
          <MoreMenu
            size="sm"
            variant="secondary"
            alignment="end"
            label="更多操作"
            items={[
              {
                label: "设置",
                icon: Cog6ToothIcon,
                onClick: handleOpenSettingsTab,
              },
              {
                label: "下载 ZIP",
                icon: ArrowDownTrayIcon,
                onClick: handleDownloadZip,
              },
            ]}
          />
          <Button
            label="发布"
            variant="primary"
            size="sm"
            icon={<Icon icon={RocketLaunchIcon} size="sm" />}
            onClick={() => {
              setPublishSlug(workspaceSlug || toSafeSlug(projectName ?? title));
              setPublishOpen(true);
            }}
          />
        </div>
      </div>

      <div style={styles.body}>
        {activeTabInstance === null ? (
          <div style={styles.emptyCenter}>
            <EmptyState
              title="默认空白页"
              description="点击上方 + 新增标签页，或从下方快速打开视图"
              actions={
                <HStack gap={2} wrap="wrap" hAlign="center">
                  {ADDABLE_TABS.map((tab) => (
                    <Button
                      key={tab}
                      label={TAB_META[tab].label}
                      variant="secondary"
                      size="sm"
                      icon={<Icon icon={TAB_META[tab].icon} size="sm" />}
                      onClick={() => handleOpenTab(tab)}
                    />
                  ))}
                </HStack>
              }
            />
          </div>
        ) : activeTabInstance.type === "preview" ? (
          !projectId && files.length === 0 && !previewOrigin ? (
            <div style={styles.emptyCenter}>
              <EmptyState
                title="暂无预览内容"
                description="在左侧发送指令，生成页面后将在此实时预览"
              />
            </div>
          ) : (
            <>
              <div className="v0-preview-bar" role="toolbar" aria-label="预览工具栏">
                <button
                  type="button"
                  className="v0-preview-icon"
                  aria-label="后退"
                  disabled={pathIndex <= 0}
                  onClick={() => travelPreview(pathIndex - 1)}
                >
                  <Icon icon={ChevronLeftIcon} size="sm" />
                </button>
                <button
                  type="button"
                  className="v0-preview-icon"
                  aria-label="前进"
                  disabled={pathIndex >= pathHistory.length - 1}
                  onClick={() => travelPreview(pathIndex + 1)}
                >
                  <Icon icon={ChevronRightIcon} size="sm" />
                </button>
                <button
                  type="button"
                  className="v0-preview-icon"
                  aria-label={viewport === "mobile" ? "切换到桌面预览" : "切换到手机预览"}
                  aria-pressed={viewport === "mobile"}
                  data-active={viewport === "mobile" ? "true" : "false"}
                  onClick={() =>
                    setViewport((value) => (value === "mobile" ? "desktop" : "mobile"))
                  }
                >
                  <Icon icon={DevicePhoneMobileIcon} size="sm" />
                </button>
                <form
                  className="v0-preview-path"
                  onSubmit={(event) => {
                    event.preventDefault();
                    commitPreviewPath(pathDraft);
                  }}
                >
                  <input
                    className="v0-preview-path-input"
                    aria-label="预览路径"
                    value={pathDraft}
                    spellCheck={false}
                    autoCapitalize="off"
                    autoCorrect="off"
                    onChange={(event) => setPathDraft(event.target.value)}
                    onBlur={() => {
                      if (pathDraft !== previewPath) commitPreviewPath(pathDraft);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Escape") {
                        setPathDraft(previewPath);
                        event.currentTarget.blur();
                      }
                    }}
                  />
                </form>
                <button
                  type="button"
                  className="v0-preview-icon"
                  aria-label="在新标签页打开"
                  disabled={!previewOrigin || serverPhase !== "running"}
                  onClick={openPreviewExternal}
                >
                  <Icon icon={ArrowTopRightOnSquareIcon} size="sm" />
                </button>
                <button
                  type="button"
                  className="v0-preview-icon"
                  aria-label="刷新预览"
                  onClick={() => setPreviewKey((key) => key + 1)}
                >
                  <Icon icon={ArrowPathIcon} size="sm" />
                </button>
                {projectId ? (
                  <div className="v0-preview-status">
                    <StatusDot
                      variant={serverPhase === "running" ? "success" : "neutral"}
                      label={
                        serverPhase === "running"
                          ? "Running"
                          : serverPhase === "starting"
                            ? "Starting"
                            : serverPhase === "stopping"
                              ? "Stopping"
                              : "Stopped"
                      }
                    />
                    <span className="v0-preview-status-label">
                      {serverPhase === "running"
                        ? "Running"
                        : serverPhase === "starting"
                          ? "Starting"
                          : serverPhase === "stopping"
                            ? "Stopping"
                            : "Stopped"}
                    </span>
                    <button
                      type="button"
                      className="v0-preview-power"
                      aria-label={
                        serverPhase === "running" ? "停止开发服务" : "启动开发服务"
                      }
                      disabled={
                        serverPhase === "starting" || serverPhase === "stopping"
                      }
                      onClick={() => void togglePreviewServer()}
                    >
                      <Icon icon={PowerIcon} size="sm" />
                    </button>
                  </div>
                ) : null}
              </div>
              <div className="v0-preview-stage" data-device={viewport}>
                <div className="v0-preview-device">
                  {previewOrigin && serverPhase === "running" ? (
                    liveFrameOrigin ? (
                      <iframe
                        key={`${previewKey}-${liveFrameOrigin}${previewPath}`}
                        className="v0-preview-iframe"
                        title={`预览：${previewPath}`}
                        sandbox="allow-scripts allow-same-origin allow-forms"
                        src={`${liveFrameOrigin}${previewPath.startsWith("/") ? previewPath : `/${previewPath}`}`}
                        style={styles.previewFrame}
                      />
                    ) : null
                  ) : files.length > 0 &&
                    serverPhase !== "starting" &&
                    serverPhase !== "stopping" &&
                    !seenLiveRef.current ? (
                    <iframe
                      key={previewKey}
                      className="v0-preview-iframe"
                      title={`预览：${title}`}
                      sandbox="allow-scripts"
                      srcDoc={previewDoc}
                      style={styles.previewFrame}
                    />
                  ) : (
                    <div className="v0-preview-paused">
                      <Text color="secondary">
                        {serverPhase === "starting"
                          ? "正在启动开发服务"
                          : serverPhase === "stopping"
                            ? "正在停止开发服务"
                            : "开发服务未运行"}
                      </Text>
                    </div>
                  )}
                  <div className="v0-preview-shield" aria-hidden="true" />
                </div>
              </div>
            </>
          )
        ) : activeTabInstance.type === "code" ? (
          !projectId && files.length === 0 ? (
            <div style={styles.emptyCenter}>
              <EmptyState
                title="暂无代码文件"
                description="在左侧发送指令后，生成的项目文件将在此展示"
              />
            </div>
          ) : (
            <Layout
              height="fill"
              start={
                <>
                  {!explorerPanel.isCollapsed && (
                    <LayoutPanel
                      width={explorerPanel.size}
                      hasDivider={false}
                      padding={0}
                    >
                      <Stack
                        direction="vertical"
                        style={styles.fileExplorer}
                        gap={2}
                      >
                        <TextInput
                          label="搜索文件"
                          isLabelHidden
                          value={fileQuery}
                          onChange={(value) => {
                            if (!currentTabId) return;
                            setFileQueryByTab((prev) => ({
                              ...prev,
                              [currentTabId]: value,
                            }));
                          }}
                          placeholder="搜索文件"
                          size="sm"
                          startIcon={MagnifyingGlassIcon}
                          hasClear
                        />
                        <div style={{ flex: 1, minHeight: 0 }}>
                          {projectId ? (
                            <WorkspaceFileTree
                              projectId={projectId}
                              revision={fileTreeRevision}
                              query={fileQuery}
                              selectedPath={selectedPath}
                              onOpenFile={(file) => {
                                if (!currentTabId) return;
                                setSelectedPathByTab((prev) => ({
                                  ...prev,
                                  [currentTabId]: file.path,
                                }));
                                setOpenedByPath((prev) => ({
                                  ...prev,
                                  [file.path]: file,
                                }));
                              }}
                            />
                          ) : (
                            <div style={{ height: "100%", overflowY: "auto" }}>
                              <TreeList items={fileTree} density="compact" />
                            </div>
                          )}
                        </div>
                      </Stack>
                    </LayoutPanel>
                  )}
                  <ResizeHandle
                    direction="horizontal"
                    hasDivider
                    isAlwaysVisible={false}
                    resizable={explorerPanel.props}
                    label="调整文件树宽度"
                  />
                </>
              }
              content={
                <LayoutContent padding={0}>
                  <Stack direction="vertical" style={{ height: "100%" }}>
                    {activeFile && (
                      <div className="v0-code-header">
                        <Text type="label" maxLines={1}>
                          {activeFile.path}
                        </Text>
                        <Button
                          label="复制当前文件"
                          variant="ghost"
                          size="sm"
                          icon={<Icon icon={ClipboardDocumentIcon} size="sm" />}
                          isIconOnly
                          onClick={() => void handleCopyActiveFile()}
                        />
                      </div>
                    )}
                    <StackItem size="fill" style={styles.editorArea}>
                      {activeFile ? (
                        <CodeBlock
                          code={activeFile.content}
                          language={activeFile.language}
                          container="section"
                          hasLanguageLabel={false}
                          hasLineNumbers
                          hasCopyButton={false}
                          size="sm"
                          style={{
                            width: "100%",
                            height: "100%",
                            borderWidth: 0,
                            borderRadius: 0,
                          }}
                        />
                      ) : (
                        <div className="v0-code-empty">
                          <Text color="secondary">请选择左侧文件查看代码</Text>
                        </div>
                      )}
                    </StackItem>
                  </Stack>
                </LayoutContent>
              }
            />
          )
        ) : activeTabInstance.type === "database" ? (
          <div style={styles.emptyCenter}>
            <EmptyState
              title="暂无数据表"
              description="当前 Project 还没有可查看的数据表"
            />
          </div>
        ) : activeTabInstance.type === "settings" ? (
          <WorkspaceSettingsPanel
            scopeKey={storageScopeKey ?? workspaceSlug}
            defaultHostname={`${workspaceSlug}.workspace.local`}
          />
        ) : (
          <div className="v0-terminal-root">
            <div className="v0-code-header">
              <HStack gap={2} vAlign="center">
                <Icon icon={CommandLineIcon} size="sm" color="secondary" />
                <Text type="label" color="secondary" maxLines={1}>
                  bash · {projectName ?? title}
                </Text>
              </HStack>
              <Button
                label="清空"
                variant="ghost"
                size="sm"
                onClick={() => {
                  if (!currentTabId) return;
                  setTerminalEntriesByTab((prev) => ({
                    ...prev,
                    [currentTabId]: [],
                  }));
                }}
              />
            </div>
            <pre ref={terminalOutputRef} className="v0-terminal-output">
              {terminalEntries.length > 0
                ? terminalEntries.join("\n")
                : "输入 help 查看可用命令"}
            </pre>
            <div className="v0-terminal-input-row">
              <Text type="supporting" color="secondary">
                $
              </Text>
              <input
                type="text"
                className="v0-terminal-input"
                value={terminalInput}
                disabled={terminalRunning}
                onChange={(event) => {
                  if (!currentTabId) return;
                  setTerminalInputByTab((prev) => ({
                    ...prev,
                    [currentTabId]: event.target.value,
                  }));
                }}
                onKeyDown={handleTerminalKeyDown}
                placeholder="输入命令后按 Enter，clear 清空输出"
                aria-label="终端命令输入"
              />
            </div>
          </div>
        )}
      </div>

      <Dialog
        isOpen={publishOpen}
        onOpenChange={(open) => {
          if (!publishing) setPublishOpen(open);
        }}
        purpose="form"
        width={440}
      >
        <Layout
          header={
            <DialogHeader
              title="发布应用"
              hasDivider
              onOpenChange={(open) => {
                if (!publishing) setPublishOpen(open);
              }}
            />
          }
          content={
            <LayoutContent>
              <VStack gap={4}>
                <TextInput
                  label="访问标识"
                  value={publishSlug}
                  onChange={setPublishSlug}
                  placeholder="agent-app"
                  isDisabled={publishing}
                />
                <Text type="supporting" color="secondary">
                  发布地址：https://{publishSlug || "agent-app"}.workspace.local
                </Text>
              </VStack>
            </LayoutContent>
          }
          footer={
            <LayoutFooter>
              <HStack gap={2} hAlign="end">
                <Button
                  label="取消"
                  variant="secondary"
                  isDisabled={publishing}
                  onClick={() => setPublishOpen(false)}
                />
                <Button
                  label="确认发布"
                  variant="primary"
                  isLoading={publishing}
                  onClick={handleConfirmPublish}
                />
              </HStack>
            </LayoutFooter>
          }
        />
      </Dialog>
    </div>
  );
}
