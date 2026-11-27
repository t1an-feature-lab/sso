import "server-only";
import { randomBytes } from "node:crypto";
import type { Duplex } from "node:stream";
import Docker from "dockerode";
import { HttpError } from "./http";
import { ensureProjectContainer, projectContainerName } from "./sandbox";

const REPLAY_LIMIT = 1_500_000;
const IDLE_MS = 30 * 60 * 1000;
const MAX_SESSIONS = 6;

type TerminalListener = (chunk: Buffer | null) => void;

type TerminalSession = {
  id: string;
  projectId: string;
  userId: string;
  createdAt: number;
  stream: Duplex;
  resize: (cols: number, rows: number) => Promise<void>;
  listeners: Set<TerminalListener>;
  replay: Buffer[];
  replayBytes: number;
  closed: boolean;
  idleTimer: ReturnType<typeof setTimeout> | null;
};

type TerminalStore = Map<string, TerminalSession>;

const storeHost = globalThis as typeof globalThis & {
  __agentBuilderTerminals?: TerminalStore;
  __agentBuilderDocker?: Docker;
};

function terminalStore(): TerminalStore {
  if (!storeHost.__agentBuilderTerminals) {
    storeHost.__agentBuilderTerminals = new Map();
  }
  return storeHost.__agentBuilderTerminals;
}

function dockerClient(): Docker {
  if (!storeHost.__agentBuilderDocker) {
    storeHost.__agentBuilderDocker = new Docker();
  }
  return storeHost.__agentBuilderDocker;
}

function clamp(value: number, min: number, max: number, fallback: number): number {
  if (!Number.isInteger(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

function dockerFailure(error: unknown, fallback: string): HttpError {
  if (error instanceof HttpError) return error;
  const message = error instanceof Error ? error.message : String(error);
  if (/ENOENT|docker\.sock|ECONNREFUSED|EACCES/i.test(message)) {
    return new HttpError(503, "Docker 未启动或当前环境无法访问 Docker");
  }
  console.error("[agent-builder terminal]", error);
  return new HttpError(503, fallback);
}

function requireSession(
  userId: string,
  projectId: string,
  sessionId: string
): TerminalSession {
  const session = terminalStore().get(sessionId);
  if (
    !session ||
    session.closed ||
    session.userId !== userId ||
    session.projectId !== projectId
  ) {
    throw new HttpError(404, "终端不存在");
  }
  return session;
}

function closeSession(session: TerminalSession): void {
  if (session.closed) return;
  session.closed = true;
  if (session.idleTimer) {
    clearTimeout(session.idleTimer);
    session.idleTimer = null;
  }
  const listeners = [...session.listeners];
  session.listeners.clear();
  terminalStore().delete(session.id);
  for (const listener of listeners) listener(null);
  try {
    session.stream.destroy();
  } catch {
    // The shell has already gone away.
  }
}

function scheduleIdle(session: TerminalSession): void {
  if (session.closed || session.listeners.size > 0 || session.idleTimer) return;
  session.idleTimer = setTimeout(() => {
    session.idleTimer = null;
    if (!session.closed && session.listeners.size === 0) closeSession(session);
  }, IDLE_MS);
  session.idleTimer.unref?.();
}

function clearIdle(session: TerminalSession): void {
  if (!session.idleTimer) return;
  clearTimeout(session.idleTimer);
  session.idleTimer = null;
}

function pushReplay(session: TerminalSession, chunk: Buffer): void {
  const copy = Buffer.from(chunk);
  session.replay.push(copy);
  session.replayBytes += copy.length;
  while (session.replayBytes > REPLAY_LIMIT && session.replay.length > 1) {
    const removed = session.replay.shift();
    if (!removed) break;
    session.replayBytes -= removed.length;
  }
}

function attachStream(session: TerminalSession): void {
  session.stream.on("data", (chunk: Buffer | string) => {
    if (session.closed) return;
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    pushReplay(session, buffer);
    for (const listener of [...session.listeners]) listener(buffer);
  });
  const finish = () => closeSession(session);
  session.stream.on("end", finish);
  session.stream.on("close", finish);
  session.stream.on("error", finish);
}

function pruneProjectSessions(projectId: string): void {
  const sessions = [...terminalStore().values()]
    .filter((session) => session.projectId === projectId && !session.closed)
    .sort((left, right) => left.createdAt - right.createdAt);
  while (sessions.length >= MAX_SESSIONS) {
    const oldest = sessions.shift();
    if (oldest) closeSession(oldest);
  }
}

export async function openTerminalSession(input: {
  userId: string;
  projectId: string;
  cols: number;
  rows: number;
}): Promise<string> {
  const cols = clamp(input.cols, 2, 500, 80);
  const rows = clamp(input.rows, 1, 300, 24);
  let stream: Duplex | null = null;
  try {
    await ensureProjectContainer(input.userId, input.projectId);
    const exec = await dockerClient()
      .getContainer(projectContainerName(input.projectId))
      .exec({
        AttachStdin: true,
        AttachStdout: true,
        AttachStderr: true,
        Tty: true,
        WorkingDir: "/workspace",
        Env: ["TERM=xterm-256color", "COLORTERM=truecolor", "LANG=C.utf8"],
        Cmd: ["bash", "-i"],
        ConsoleSize: [rows, cols],
      });
    stream = await exec.start({ hijack: true, stdin: true, Tty: true });
    await exec.resize({ h: rows, w: cols }).catch(() => undefined);
    const session: TerminalSession = {
      id: randomBytes(16).toString("hex"),
      projectId: input.projectId,
      userId: input.userId,
      createdAt: Date.now(),
      stream,
      resize: async (nextCols, nextRows) => {
        await exec.resize({
          h: clamp(nextRows, 1, 300, 24),
          w: clamp(nextCols, 2, 500, 80),
        });
      },
      listeners: new Set(),
      replay: [],
      replayBytes: 0,
      closed: false,
      idleTimer: null,
    };
    attachStream(session);
    pruneProjectSessions(input.projectId);
    terminalStore().set(session.id, session);
    scheduleIdle(session);
    stream = null;
    return session.id;
  } catch (error) {
    stream?.destroy();
    throw dockerFailure(error, "终端启动失败");
  }
}

export function writeTerminalSession(input: {
  userId: string;
  projectId: string;
  sessionId: string;
  data: string;
}): void {
  if (input.data.length > 256_000) {
    throw new HttpError(400, "输入过长");
  }
  const session = requireSession(input.userId, input.projectId, input.sessionId);
  try {
    session.stream.write(Buffer.from(input.data, "utf8"));
  } catch {
    closeSession(session);
    throw new HttpError(410, "终端已关闭");
  }
}

export async function resizeTerminalSession(input: {
  userId: string;
  projectId: string;
  sessionId: string;
  cols: number;
  rows: number;
}): Promise<void> {
  const session = requireSession(input.userId, input.projectId, input.sessionId);
  try {
    await session.resize(input.cols, input.rows);
  } catch (error) {
    closeSession(session);
    throw dockerFailure(error, "终端已关闭");
  }
}

export function assertTerminalSession(
  userId: string,
  projectId: string,
  sessionId: string
): void {
  const session = terminalStore().get(sessionId);
  if (!session || session.userId !== userId || session.projectId !== projectId) {
    throw new HttpError(404, "终端不存在");
  }
}

export function attachTerminalSession(
  userId: string,
  projectId: string,
  sessionId: string,
  listener: TerminalListener
): { replay: Buffer; closed: boolean; unsubscribe: () => void } {
  const session = terminalStore().get(sessionId);
  if (
    !session ||
    session.userId !== userId ||
    session.projectId !== projectId
  ) {
    throw new HttpError(404, "终端不存在");
  }
  const replay =
    session.replayBytes > 0 ? Buffer.concat(session.replay) : Buffer.alloc(0);
  if (session.closed) {
    return { replay, closed: true, unsubscribe: () => undefined };
  }
  session.listeners.add(listener);
  clearIdle(session);
  return {
    replay,
    closed: false,
    unsubscribe: () => {
      session.listeners.delete(listener);
      scheduleIdle(session);
    },
  };
}

export function closeTerminalSession(
  userId: string,
  projectId: string,
  sessionId: string
): void {
  const session = terminalStore().get(sessionId);
  if (!session || session.userId !== userId || session.projectId !== projectId) {
    return;
  }
  closeSession(session);
}
