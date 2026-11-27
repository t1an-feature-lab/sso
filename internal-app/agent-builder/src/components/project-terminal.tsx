"use client";

import { useEffect, useRef, useState } from "react";
import { FitAddon } from "@xterm/addon-fit";
import { Terminal, type ITheme } from "@xterm/xterm";
import "@xterm/xterm/css/xterm.css";
import { Button } from "@astryxdesign/core/Button";
import { EmptyState } from "@astryxdesign/core/EmptyState";
import { apiClient } from "@/lib/api-client";
import type { ProjectFile } from "@/lib/types";

type Phase = "connecting" | "open" | "closed" | "error";

const sessions = new Map<string, string>();
const pendingOpens = new Map<string, Promise<string>>();
const acquireGeneration = new Map<string, number>();

const LIGHT_ANSI: ITheme = {
  black: "#24292f",
  red: "#cf222e",
  green: "#116329",
  yellow: "#7d4e00",
  blue: "#0550ae",
  magenta: "#8250df",
  cyan: "#0969da",
  white: "#57606a",
  brightBlack: "#57606a",
  brightRed: "#a40e26",
  brightGreen: "#1a7f37",
  brightYellow: "#633c01",
  brightBlue: "#0969da",
  brightMagenta: "#8250df",
  brightCyan: "#1b7c83",
  brightWhite: "#24292f",
};

const DARK_ANSI: ITheme = {
  black: "#484f58",
  red: "#ff7b72",
  green: "#3fb950",
  yellow: "#d29922",
  blue: "#58a6ff",
  magenta: "#bc8cff",
  cyan: "#39c5cf",
  white: "#b1bac4",
  brightBlack: "#6e7681",
  brightRed: "#ffa198",
  brightGreen: "#56d364",
  brightYellow: "#e3b341",
  brightBlue: "#79c0ff",
  brightMagenta: "#d2a8ff",
  brightCyan: "#56d4dd",
  brightWhite: "#f0f6fc",
};

function sessionKey(projectId: string, tabId: string): string {
  return `${projectId}:${tabId}`;
}

function storageKey(projectId: string, tabId: string): string {
  return `ab-term:${projectId}:${tabId}`;
}

function readStored(projectId: string, tabId: string): string | null {
  try {
    const value = sessionStorage.getItem(storageKey(projectId, tabId));
    return value && /^[a-f0-9]{32}$/.test(value) ? value : null;
  } catch {
    return null;
  }
}

function remember(projectId: string, tabId: string, sessionId: string): void {
  sessions.set(sessionKey(projectId, tabId), sessionId);
  try {
    sessionStorage.setItem(storageKey(projectId, tabId), sessionId);
  } catch {
    // Ignore storage failures and keep the in-memory session.
  }
}

function forget(projectId: string, tabId: string): void {
  sessions.delete(sessionKey(projectId, tabId));
  try {
    sessionStorage.removeItem(storageKey(projectId, tabId));
  } catch {
    // Ignore storage failures.
  }
}

function deleteSession(projectId: string, sessionId: string): void {
  void fetch(
    `/api/projects/${encodeURIComponent(projectId)}/terminal/${sessionId}`,
    { method: "DELETE", keepalive: true }
  ).catch(() => undefined);
}

export function releaseProjectTerminal(projectId: string, tabId: string): void {
  const key = sessionKey(projectId, tabId);
  acquireGeneration.set(key, (acquireGeneration.get(key) ?? 0) + 1);
  const existing = sessions.get(key) ?? readStored(projectId, tabId);
  pendingOpens.delete(key);
  forget(projectId, tabId);
  if (existing) deleteSession(projectId, existing);
}

async function acquireProjectTerminal(
  projectId: string,
  tabId: string,
  cols: number,
  rows: number,
  fresh: boolean
): Promise<string> {
  const key = sessionKey(projectId, tabId);
  if (!fresh) {
    const existing = sessions.get(key) ?? readStored(projectId, tabId);
    if (existing) {
      sessions.set(key, existing);
      return existing;
    }
    const pending = pendingOpens.get(key);
    if (pending) return pending;
  }
  const generation = acquireGeneration.get(key) ?? 0;
  const task = apiClient
    .openProjectTerminal(projectId, cols, rows)
    .then((result) => {
      if ((acquireGeneration.get(key) ?? 0) !== generation) {
        deleteSession(projectId, result.sessionId);
        throw new DOMException("已取消", "AbortError");
      }
      remember(projectId, tabId, result.sessionId);
      return result.sessionId;
    });
  const tracked = task.finally(() => {
    if (pendingOpens.get(key) === tracked) pendingOpens.delete(key);
  });
  pendingOpens.set(key, tracked);
  return tracked;
}

function luminance(color: string): number | null {
  const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (!match) return null;
  const red = Number(match[1]);
  const green = Number(match[2]);
  const blue = Number(match[3]);
  return (0.2126 * red + 0.7152 * green + 0.0722 * blue) / 255;
}

function themeFor(host: HTMLElement): ITheme {
  const style = getComputedStyle(host);
  const background = style.backgroundColor;
  const foreground = style.color;
  const dark = (luminance(background) ?? 1) < 0.5;
  return {
    background,
    foreground,
    cursor: foreground,
    cursorAccent: background,
    selectionBackground: dark ? "rgba(255,255,255,0.28)" : "rgba(34,91,255,0.28)",
    selectionInactiveBackground: dark
      ? "rgba(255,255,255,0.16)"
      : "rgba(34,91,255,0.16)",
    ...(dark ? DARK_ANSI : LIGHT_ANSI),
  };
}

function isAbort(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

function terminalShortcut(event: KeyboardEvent): string | null {
  const command = event.metaKey && !event.ctrlKey && !event.altKey && !event.shiftKey;
  const option = event.altKey && !event.metaKey && !event.ctrlKey && !event.shiftKey;
  if (command && event.key === "ArrowLeft") return "\x01";
  if (command && event.key === "ArrowRight") return "\x05";
  if (command && event.key === "Backspace") return "\x15";
  if (option && event.key === "ArrowLeft") return "\x1bb";
  if (option && event.key === "ArrowRight") return "\x1bf";
  return null;
}

export function ProjectTerminal({
  projectId,
  tabId,
  onWorkspaceChange,
}: {
  projectId: string | null;
  tabId: string;
  onWorkspaceChange?: (update: {
    files: ProjectFile[];
    previewUrl: string | null;
  }) => void;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const restartRef = useRef<() => void>(() => undefined);
  const onWorkspaceChangeRef = useRef(onWorkspaceChange);
  onWorkspaceChangeRef.current = onWorkspaceChange;
  const [phase, setPhase] = useState<Phase>(projectId ? "connecting" : "closed");

  useEffect(() => {
    if (!projectId || !tabId || !hostRef.current) return;
    const host = hostRef.current;
    const project = projectId;
    const term = new Terminal({
      cursorBlink: true,
      cursorStyle: "block",
      fontFamily:
        'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace',
      fontSize: 13,
      lineHeight: 1.2,
      macOptionIsMeta: true,
      scrollback: 5000,
      theme: themeFor(host),
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(host);
    fit.fit();
    term.focus();
    term.attachCustomKeyEventHandler((event) => {
      if (event.type !== "keydown" || event.isComposing) return true;
      const plain = !event.ctrlKey && !event.altKey && !event.shiftKey;
      const copy =
        (event.metaKey && plain && event.code === "KeyC") ||
        (event.ctrlKey && event.shiftKey && !event.metaKey && !event.altKey && event.code === "KeyC");
      if (copy) {
        if (!term.hasSelection()) return true;
        const selected = term.getSelection();
        if (selected) void navigator.clipboard.writeText(selected);
        event.preventDefault();
        return false;
      }
      if (event.metaKey && plain && event.code === "KeyK") {
        event.preventDefault();
        term.clear();
        return false;
      }
      const sequence = terminalShortcut(event);
      if (!sequence) return true;
      event.preventDefault();
      term.input(sequence);
      return false;
    });

    let disposed = false;
    let generation = 0;
    let streamAbort = new AbortController();
    let activeSession = "";
    let inputBuffer = "";
    let sending = false;
    let outputSeq = 0;
    let syncedSeq = 0;
    let syncing = false;
    let syncTimer = 0;
    let resizeTimer = 0;

    const applyTheme = () => {
      term.options.theme = themeFor(host);
    };
    const themeObserver = new MutationObserver(applyTheme);
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme", "style"],
    });
    const colorScheme = window.matchMedia("(prefers-color-scheme: dark)");
    colorScheme.addEventListener("change", applyTheme);
    const resizeObserver = new ResizeObserver(() => {
      if (!hostIsVisible()) return;
      fit.fit();
    });
    resizeObserver.observe(host);
    void document.fonts?.ready.then(() => {
      if (!disposed && hostIsVisible()) fit.fit();
    });

    function scheduleSync() {
      if (syncTimer) return;
      syncTimer = window.setTimeout(() => {
        syncTimer = 0;
        void syncWorkspace();
      }, 1200);
    }

    async function syncWorkspace() {
      if (syncing || disposed) return;
      const mark = outputSeq;
      if (mark === syncedSeq) return;
      syncing = true;
      try {
        const snapshot = await apiClient.syncProjectSnapshot(project);
        if (disposed) return;
        syncedSeq = mark;
        onWorkspaceChangeRef.current?.({
          files: snapshot.files,
          previewUrl: snapshot.previewUrl,
        });
      } catch {
        // The shell keeps running when the file list cannot refresh.
      } finally {
        syncing = false;
        if (!disposed && outputSeq !== syncedSeq) scheduleSync();
      }
    }

    function noteOutput(chunk: Uint8Array) {
      if (!chunk.includes(10)) return;
      outputSeq += 1;
      scheduleSync();
    }

    async function flushInput() {
      if (sending) return;
      sending = true;
      try {
        while (inputBuffer && activeSession && !disposed) {
          const data = inputBuffer;
          const id = activeSession;
          inputBuffer = "";
          await apiClient.writeProjectTerminal(project, id, { data });
        }
      } catch {
        // The output stream reports a closed shell.
      } finally {
        sending = false;
        if (inputBuffer && activeSession && !disposed) void flushInput();
      }
    }

    const inputDisposable = term.onData((data) => {
      inputBuffer += data;
      void flushInput();
    });
    const resizeDisposable = term.onResize(({ cols, rows }) => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => {
        if (!activeSession || disposed || !hostIsVisible()) return;
        void apiClient
          .writeProjectTerminal(project, activeSession, { cols, rows })
          .catch(() => undefined);
      }, 40);
    });

    function hostIsVisible(): boolean {
      return host.clientWidth >= 40 && host.clientHeight >= 40;
    }

    async function readStream(
      id: string,
      signal: AbortSignal,
      current: number
    ): Promise<"eof" | "missing"> {
      const response = await fetch(
        `/api/projects/${encodeURIComponent(project)}/terminal/${id}`,
        { signal, cache: "no-store" }
      );
      if (response.status === 404) {
        await response.body?.cancel().catch(() => undefined);
        return "missing";
      }
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(payload?.error || "终端连接失败");
      }
      if (!response.body) throw new Error("终端连接失败");
      if (!disposed && current === generation && !signal.aborted) {
        setPhase("open");
        term.focus();
      }
      const reader = response.body.getReader();
      while (!signal.aborted) {
        const { done, value } = await reader.read();
        if (done) return "eof";
        if (value) {
          term.write(value);
          noteOutput(value);
        }
      }
      return "eof";
    }

    async function openSession(fresh: boolean) {
      const current = ++generation;
      streamAbort.abort();
      streamAbort = new AbortController();
      const signal = streamAbort.signal;
      if (fresh) {
        releaseProjectTerminal(project, tabId);
        term.reset();
        inputBuffer = "";
        activeSession = "";
      }
      setPhase("connecting");
      let createFresh = fresh;
      try {
        for (let attempt = 0; attempt < 2; attempt += 1) {
          if (current !== generation || signal.aborted) return;
          const id = await acquireProjectTerminal(
            project,
            tabId,
            Math.max(2, term.cols || 80),
            Math.max(1, term.rows || 24),
            createFresh
          );
          if (current !== generation || signal.aborted) return;
          activeSession = id;
          void flushInput();
          const result = await readStream(id, signal, current);
          if (current !== generation || signal.aborted) return;
          if (result === "missing" && !createFresh) {
            releaseProjectTerminal(project, tabId);
            activeSession = "";
            createFresh = true;
            term.reset();
            continue;
          }
          if (result === "missing") throw new Error("终端不存在");
          setPhase("closed");
          term.write("\r\n已退出\r\n");
          void syncWorkspace();
          return;
        }
      } catch (error) {
        if (current !== generation || signal.aborted || isAbort(error)) return;
        activeSession = "";
        setPhase("error");
        const message = error instanceof Error ? error.message : "终端连接失败";
        term.write(`\r\n${message}\r\n`);
      }
    }

    restartRef.current = () => {
      void openSession(true);
    };
    let started = false;
    function maybeStart() {
      if (started || disposed || !hostIsVisible()) return;
      started = true;
      fit.fit();
      void openSession(false);
    }
    maybeStart();
    const startObserver = new ResizeObserver(() => maybeStart());
    startObserver.observe(host);

    return () => {
      disposed = true;
      generation += 1;
      streamAbort.abort();
      window.clearTimeout(resizeTimer);
      window.clearTimeout(syncTimer);
      themeObserver.disconnect();
      colorScheme.removeEventListener("change", applyTheme);
      resizeObserver.disconnect();
      startObserver.disconnect();
      inputDisposable.dispose();
      resizeDisposable.dispose();
      term.dispose();
    };
  }, [projectId, tabId]);

  return (
    <div className="v0-terminal-root">
      {projectId ? (
        <div ref={hostRef} className="v0-terminal-screen" aria-label="终端" />
      ) : (
        <div className="v0-terminal-empty">
          <EmptyState
            title="当前会话没有 Project"
            description="终端会连接到当前 Project 的工作空间"
          />
        </div>
      )}
      {projectId && (phase === "closed" || phase === "error") ? (
        <div className="v0-terminal-reconnect">
          <Button
            label="重新连接"
            variant="ghost"
            size="sm"
            onClick={() => restartRef.current()}
          />
        </div>
      ) : null}
    </div>
  );
}
