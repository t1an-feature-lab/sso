export type WorkspacePanelTab =
  | "preview"
  | "code"
  | "database"
  | "terminal"
  | "settings";

export interface WorkspaceTabInstance {
  id: string;
  type: WorkspacePanelTab;
  index: number;
}

export interface PersistedWorkspaceTabs {
  openTabs: WorkspaceTabInstance[];
  activeTabId: string | null;
  counters: Record<WorkspacePanelTab, number>;
}

export const WORKSPACE_TABS_COOKIE = "agent_builder_workspace_tabs";

const VALID_TAB_TYPES = new Set<WorkspacePanelTab>([
  "preview",
  "code",
  "database",
  "terminal",
  "settings",
]);

export const DEFAULT_PERSISTED_TABS: PersistedWorkspaceTabs = {
  openTabs: [{ id: "preview-1", type: "preview", index: 1 }],
  activeTabId: "preview-1",
  counters: {
    preview: 1,
    code: 0,
    database: 0,
    terminal: 0,
    settings: 0,
  },
};

interface CompactWorkspaceTabsCookie {
  t?: unknown;
  a?: unknown;
  c?: Partial<Record<WorkspacePanelTab, unknown>>;
}

function parseTabId(id: string): WorkspaceTabInstance | null {
  const match = /^(preview|code|database|terminal|settings)-(\d+)$/.exec(id);
  if (!match) return null;
  const type = match[1] as WorkspacePanelTab;
  const index = Number(match[2]);
  if (!Number.isInteger(index) || index < 1 || !VALID_TAB_TYPES.has(type)) {
    return null;
  }
  return { id: `${type}-${index}`, type, index };
}

export function parseWorkspaceTabsCookie(
  raw: string | undefined | null
): PersistedWorkspaceTabs {
  if (!raw) return DEFAULT_PERSISTED_TABS;
  try {
    const parsed = JSON.parse(raw) as CompactWorkspaceTabsCookie;
    if (!Array.isArray(parsed.t)) {
      return DEFAULT_PERSISTED_TABS;
    }

    const seenIds = new Set<string>();
    let hasPreview = false;
    const openTabs: WorkspaceTabInstance[] = [];

    for (const item of parsed.t) {
      if (typeof item !== "string") continue;
      const tab = parseTabId(item);
      if (!tab) continue;
      if (tab.type === "preview") {
        if (hasPreview) continue;
        hasPreview = true;
      }
      if (seenIds.has(tab.id)) continue;
      seenIds.add(tab.id);
      openTabs.push(tab);
    }

    const counters: Record<WorkspacePanelTab, number> = {
      preview: Math.max(
        1,
        typeof parsed.c?.preview === "number" ? parsed.c.preview : 1
      ),
      code: typeof parsed.c?.code === "number" ? parsed.c.code : 0,
      database: typeof parsed.c?.database === "number" ? parsed.c.database : 0,
      terminal: typeof parsed.c?.terminal === "number" ? parsed.c.terminal : 0,
      settings: typeof parsed.c?.settings === "number" ? parsed.c.settings : 0,
    };

    for (const tab of openTabs) {
      if (tab.index > counters[tab.type]) {
        counters[tab.type] = tab.index;
      }
    }

    const activeTabId =
      typeof parsed.a === "string" && openTabs.some((t) => t.id === parsed.a)
        ? parsed.a
        : openTabs[0]?.id ?? null;

    return { openTabs, activeTabId, counters };
  } catch {
    return DEFAULT_PERSISTED_TABS;
  }
}

export function serializeWorkspaceTabsCookie(
  state: PersistedWorkspaceTabs
): string {
  const compact: CompactWorkspaceTabsCookie = {
    t: state.openTabs.map((tab) => tab.id),
    a: state.activeTabId,
    c: state.counters,
  };
  return JSON.stringify(compact);
}

export function readWorkspaceTabsRawFromDocument(): string | null {
  if (typeof document === "undefined") return null;
  const prefix = `${WORKSPACE_TABS_COOKIE}=`;
  const parts = document.cookie.split(";");
  for (const part of parts) {
    const trimmed = part.trim();
    if (trimmed.startsWith(prefix)) {
      try {
        return decodeURIComponent(trimmed.slice(prefix.length));
      } catch {
        return null;
      }
    }
  }
  return null;
}

export function writeWorkspaceTabsCookie(state: PersistedWorkspaceTabs): string {
  const raw = serializeWorkspaceTabsCookie(state);
  if (typeof document !== "undefined") {
    document.cookie = `${WORKSPACE_TABS_COOKIE}=${encodeURIComponent(raw)}; path=/; max-age=31536000; SameSite=Lax`;
  }
  return raw;
}
