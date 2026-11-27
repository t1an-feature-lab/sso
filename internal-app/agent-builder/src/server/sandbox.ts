import "server-only";
import { spawn } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { lstat, mkdir, readdir, readFile, rm } from "node:fs/promises";
import net from "node:net";
import path from "node:path";
import { randomBytes } from "node:crypto";
import type {
  ProjectCommandResult,
  ProjectFile,
  WorkspaceEntry,
} from "@/lib/types";
import { HttpError } from "./http";

const IMAGE = "agent-builder-sandbox:local";
const NETWORK = "agent-builder-sandboxes";
const WORKSPACE_MOUNT = "/workspace";
const PREVIEW_PORTS = [3000, 5173, 4173, 8080, 8000] as const;
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const SKIP_DIRS = new Set([
  ".git",
  ".agent",
  ".next",
  "node_modules",
  ".pnpm-store",
  "dist",
  "coverage",
  ".turbo",
]);

const LANG_BY_EXT: Record<string, string> = {
  ts: "typescript",
  tsx: "tsx",
  js: "javascript",
  jsx: "jsx",
  mjs: "javascript",
  cjs: "javascript",
  css: "css",
  scss: "scss",
  html: "html",
  json: "json",
  md: "markdown",
  py: "python",
  yml: "yaml",
  yaml: "yaml",
  sh: "bash",
  toml: "toml",
  svg: "xml",
  xml: "xml",
};

const RUNNER_SCRIPT = `
import { spawn } from "node:child_process";
import { closeSync, mkdirSync, openSync, readFileSync, writeFileSync } from "node:fs";

const id = process.env.AGENT_ID || "";
const timeoutMs = Number(process.env.AGENT_TIMEOUT_MS || "180000");
const command = Buffer.from(process.env.AGENT_CMD_B64 || "", "base64").toString("utf8");
if (!/^[a-f0-9]{16}$/.test(id) || !command) {
  process.stderr.write("invalid command");
  process.exit(1);
}

const dir = "/workspace/.agent/procs";
mkdirSync(dir, { recursive: true });
const logPath = dir + "/" + id + ".log";
const fd = openSync(logPath, "a");
const child = spawn("bash", ["-lc", command], {
  cwd: "/workspace",
  detached: true,
  stdio: ["ignore", fd, fd],
});
writeFileSync(dir + "/" + id + ".pid", String(child.pid));
writeFileSync(dir + "/" + id + ".cmd", command);

let released = false;

function tail() {
  try {
    const text = readFileSync(logPath, "utf8");
    return text.length > 30000 ? text.slice(-30000) : text;
  } catch {
    return "";
  }
}

function finish(status, exitCode) {
  if (released) return;
  released = true;
  if (status === "running") child.unref();
  try { closeSync(fd); } catch {}
  process.stdout.write(JSON.stringify({
    status,
    exitCode,
    pid: child.pid,
    id,
    output: tail(),
    logPath: ".agent/procs/" + id + ".log",
  }));
  process.exit(0);
}

process.on("SIGTERM", () => {
  if (!released) {
    try { process.kill(-child.pid, "SIGTERM"); } catch {}
    try { process.kill(child.pid, "SIGTERM"); } catch {}
  }
  process.exit(143);
});

const timer = setTimeout(() => finish("running", null), timeoutMs);
child.on("exit", (code, signal) => {
  clearTimeout(timer);
  finish("exited", code ?? (signal ? 1 : 0));
});
child.on("error", () => {
  clearTimeout(timer);
  finish("exited", 1);
});
`;

const PORT_SCAN_SCRIPT = `
import { readFileSync } from "node:fs";
function ports(file) {
  let text = "";
  try { text = readFileSync(file, "utf8"); } catch { return []; }
  const found = [];
  for (const line of text.trim().split("\\n").slice(1)) {
    const parts = line.trim().split(/\\s+/);
    if (parts[3] !== "0A") continue;
    const hex = (parts[1] || "").split(":").pop();
    const port = Number.parseInt(hex || "", 16);
    if (port > 0) found.push(port);
  }
  return found;
}
const all = new Set([...ports("/proc/net/tcp"), ...ports("/proc/net/tcp6")]);
process.stdout.write([...all].join(","));
`;

const STOP_PREVIEW_SCRIPT = `
import { readdirSync, readFileSync, readlinkSync } from "node:fs";

const signalName = process.env.AGENT_STOP_SIGNAL === "SIGTERM" ? "SIGTERM" : "SIGINT";
const previewPorts = new Set([3000, 5173, 4173, 8080, 8000]);
const devRe = /(?:^|[;&|]\\s*)(?:pnpm|npm|yarn|bun)\\s+(?:run\\s+)?(?:dev|start|serve|preview|watch)\\b|(?:^|[;&|]\\s*)(?:next|vite|astro|nuxt)\\s+(?:dev|preview)\\b/;

function alive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function pgrp(pid) {
  try {
    const stat = readFileSync("/proc/" + pid + "/stat", "utf8");
    const end = stat.lastIndexOf(")");
    const rest = stat.slice(end + 2).trim().split(/\\s+/);
    const group = Number(rest[2]);
    return Number.isInteger(group) && group > 1 ? group : pid;
  } catch {
    return pid;
  }
}

function listeningPids() {
  const inodes = new Set();
  for (const file of ["/proc/net/tcp", "/proc/net/tcp6"]) {
    let text = "";
    try { text = readFileSync(file, "utf8"); } catch { continue; }
    for (const line of text.trim().split("\\n").slice(1)) {
      const parts = line.trim().split(/\\s+/);
      if (parts[3] !== "0A") continue;
      const port = Number.parseInt((parts[1] || "").split(":").pop() || "", 16);
      if (!previewPorts.has(port)) continue;
      if (parts[9] && parts[9] !== "0") inodes.add(parts[9]);
    }
  }
  if (inodes.size === 0) return [];
  const pids = [];
  let entries = [];
  try { entries = readdirSync("/proc"); } catch { return []; }
  for (const entry of entries) {
    if (!/^\\d+$/.test(entry)) continue;
    const pid = Number(entry);
    if (pid <= 1) continue;
    let fds = [];
    try { fds = readdirSync("/proc/" + entry + "/fd"); } catch { continue; }
    for (const fd of fds) {
      let link = "";
      try { link = readlinkSync("/proc/" + entry + "/fd/" + fd); } catch { continue; }
      const matched = /^socket:\\[(\\d+)\\]$/.exec(link);
      if (matched && inodes.has(matched[1])) {
        pids.push(pid);
        break;
      }
    }
  }
  return pids;
}

function recordedDevPids() {
  const dir = "/workspace/.agent/procs";
  const pids = [];
  let names = [];
  try { names = readdirSync(dir); } catch { return pids; }
  for (const name of names) {
    if (!name.endsWith(".cmd")) continue;
    const id = name.slice(0, -4);
    let cmd = "";
    try { cmd = readFileSync(dir + "/" + name, "utf8"); } catch { continue; }
    if (!devRe.test(cmd)) continue;
    let pid = 0;
    try { pid = Number(readFileSync(dir + "/" + id + ".pid", "utf8")); } catch { continue; }
    if (Number.isInteger(pid) && pid > 1 && alive(pid)) pids.push(pid);
  }
  return pids;
}

const groups = new Set();
for (const pid of [...listeningPids(), ...recordedDevPids()]) {
  if (pid > 1) groups.add(pgrp(pid));
}
let signaled = 0;
for (const group of groups) {
  if (group <= 1) continue;
  try {
    process.kill(-group, signalName);
    signaled += 1;
  } catch {
    try {
      process.kill(group, signalName);
      signaled += 1;
    } catch {}
  }
}
process.stdout.write(JSON.stringify({ signaled }));
`;

type RuntimeRecord = {
  containerName: string;
  ports: Record<string, number>;
  previewUrl: string | null;
};

type StatusListener = (message: string) => void;

const projectLocks = new Map<string, Promise<unknown>>();
let imageReady: Promise<void> | null = null;
let networkReady: Promise<void> | null = null;

function sandboxRoot(): string {
  return path.resolve(process.cwd(), "storage", "workspace");
}

function runtimeRoot(): string {
  return path.resolve(process.cwd(), "storage", "runtime");
}

function assertId(value: string, label: string): void {
  if (!UUID_RE.test(value)) {
    throw new HttpError(400, `${label}无效`);
  }
}

function assertInside(root: string, target: string): void {
  const relative = path.relative(root, target);
  if (relative === "" || relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new HttpError(400, "工作空间路径无效");
  }
}

export function projectWorkspacePath(userId: string, projectId: string): string {
  assertId(userId, "用户");
  assertId(projectId, "Project");
  const root = sandboxRoot();
  const target = path.resolve(root, userId, projectId);
  assertInside(root, target);
  return target;
}

function runtimePath(projectId: string): string {
  assertId(projectId, "Project");
  const root = runtimeRoot();
  const target = path.resolve(root, `${projectId}.json`);
  assertInside(root, target);
  return target;
}

function containerName(projectId: string): string {
  assertId(projectId, "Project");
  return `ab-${projectId}`;
}

function samePath(left: string, right: string): boolean {
  try {
    return realpathSync(left) === realpathSync(right);
  } catch {
    return path.resolve(left) === path.resolve(right);
  }
}

function isDockerMissing(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "ENOENT"
  );
}

function runDocker(
  args: string[],
  options?: { input?: string; timeoutMs?: number; signal?: AbortSignal }
): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn("docker", args, { stdio: ["pipe", "pipe", "pipe"] });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    let stdoutLen = 0;
    let stderrLen = 0;
    const cap = 1_000_000;
    const timer = options?.timeoutMs
      ? setTimeout(() => child.kill("SIGTERM"), options.timeoutMs)
      : null;
    const onAbort = () => child.kill("SIGTERM");
    options?.signal?.addEventListener("abort", onAbort);

    child.stdout.on("data", (chunk: Buffer) => {
      stdoutLen += chunk.length;
      if (stdoutLen <= cap) stdout.push(chunk);
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderrLen += chunk.length;
      if (stderrLen <= cap) stderr.push(chunk);
    });
    child.on("error", (error) => {
      if (timer) clearTimeout(timer);
      options?.signal?.removeEventListener("abort", onAbort);
      reject(error);
    });
    child.on("close", (code) => {
      if (timer) clearTimeout(timer);
      options?.signal?.removeEventListener("abort", onAbort);
      resolve({
        code: code ?? 1,
        stdout: Buffer.concat(stdout).toString("utf8"),
        stderr: Buffer.concat(stderr).toString("utf8"),
      });
    });
    if (options?.input) child.stdin.write(options.input);
    child.stdin.end();
  });
}

async function docker(
  args: string[],
  options?: { input?: string; timeoutMs?: number; signal?: AbortSignal }
): Promise<{ code: number; stdout: string; stderr: string }> {
  try {
    return await runDocker(args, options);
  } catch (error) {
    if (isDockerMissing(error)) {
      throw new HttpError(503, "Docker 未启动或当前环境无法访问 Docker");
    }
    throw error;
  }
}

function readRuntime(projectId: string): RuntimeRecord | null {
  try {
    const raw = readFileSync(runtimePath(projectId), "utf8");
    const parsed = JSON.parse(raw) as Partial<RuntimeRecord>;
    if (!parsed || typeof parsed.containerName !== "string" || !parsed.ports) {
      return null;
    }
    return {
      containerName: parsed.containerName,
      ports: parsed.ports,
      previewUrl: typeof parsed.previewUrl === "string" ? parsed.previewUrl : null,
    };
  } catch {
    return null;
  }
}

function writeRuntime(projectId: string, record: RuntimeRecord): void {
  const file = runtimePath(projectId);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(record));
}

export async function readPreviewUrl(projectId: string): Promise<string | null> {
  if (!UUID_RE.test(projectId)) return null;
  return readRuntime(projectId)?.previewUrl ?? null;
}

export async function ensureWorkspaceDir(
  userId: string,
  projectId: string
): Promise<string> {
  const dir = projectWorkspacePath(userId, projectId);
  await mkdir(dir, { recursive: true });
  const root = realpathSync(sandboxRoot());
  const real = realpathSync(dir);
  assertInside(root, real);
  return real;
}

async function ensureImage(onStatus?: StatusListener): Promise<void> {
  if (!imageReady) {
    imageReady = (async () => {
      onStatus?.("正在准备沙箱镜像");
      const context = path.join(process.cwd(), "sandbox");
      const built = await docker(["build", "-t", IMAGE, context], {
        timeoutMs: 600_000,
      });
      if (built.code !== 0) {
        throw new HttpError(503, "沙箱镜像构建失败");
      }
    })().catch((error) => {
      imageReady = null;
      throw error;
    });
  }
  await imageReady;
}

async function ensureNetwork(): Promise<void> {
  if (!networkReady) {
    networkReady = (async () => {
      const inspected = await docker(["network", "inspect", NETWORK], {
        timeoutMs: 20_000,
      });
      if (inspected.code === 0) return;
      const created = await docker(
        [
          "network",
          "create",
          "--driver",
          "bridge",
          "-o",
          "com.docker.network.bridge.enable_icc=false",
          NETWORK,
        ],
        { timeoutMs: 20_000 }
      );
      if (
        created.code !== 0 &&
        !/already exists/i.test(`${created.stderr}\n${created.stdout}`)
      ) {
        throw new HttpError(503, "沙箱网络创建失败");
      }
    })().catch((error) => {
      networkReady = null;
      throw error;
    });
  }
  await networkReady;
}

function reservePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = address && typeof address === "object" ? address.port : 0;
      server.close((error) => (error ? reject(error) : resolve(port)));
    });
    server.on("error", reject);
  });
}

async function allocatePorts(): Promise<Record<string, number>> {
  const ports: Record<string, number> = {};
  for (const containerPort of PREVIEW_PORTS) {
    ports[String(containerPort)] = await reservePort();
  }
  return ports;
}

async function inspectContainer(name: string): Promise<{
  exists: boolean;
  running: boolean;
  userId: string;
  mountSource: string;
} | null> {
  const inspected = await docker(
    [
      "inspect",
      "--format",
      '{{.State.Running}}|{{index .Config.Labels "agent-builder.userId"}}|{{range .Mounts}}{{if eq .Destination "/workspace"}}{{.Source}}{{end}}{{end}}',
      name,
    ],
    { timeoutMs: 20_000 }
  );
  if (inspected.code !== 0) {
    if (/no such object|no such container/i.test(inspected.stderr)) return null;
    throw new HttpError(503, "读取 Project 容器失败");
  }
  const [running = "", userId = "", mountSource = ""] = inspected.stdout
    .trim()
    .split("|");
  return {
    exists: true,
    running: running === "true",
    userId,
    mountSource,
  };
}

async function startContainer(
  userId: string,
  projectId: string,
  workspace: string,
  onStatus?: StatusListener
): Promise<RuntimeRecord> {
  const name = containerName(projectId);
  const current = await inspectContainer(name);
  const existingRuntime = readRuntime(projectId);
  if (current && current.userId === userId && samePath(current.mountSource, workspace)) {
    if (!current.running) {
      onStatus?.("正在启动 Project 容器");
      const started = await docker(["start", name], { timeoutMs: 30_000 });
      if (started.code !== 0) {
        throw new HttpError(503, "启动 Project 容器失败");
      }
    }
    if (existingRuntime) return existingRuntime;
  } else if (current) {
    await docker(["rm", "-f", name], { timeoutMs: 30_000 });
  }

  onStatus?.("正在启动 Project 容器");
  let lastError = "启动 Project 容器失败";
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const ports = await allocatePorts();
    const args = [
      "run",
      "-d",
      "--name",
      name,
      "--label",
      `agent-builder.userId=${userId}`,
      "--label",
      `agent-builder.projectId=${projectId}`,
      "--cap-drop",
      "ALL",
      "--security-opt",
      "no-new-privileges:true",
      "--pids-limit",
      "512",
      "--memory",
      "2g",
      "--cpus",
      "2",
      "--restart",
      "no",
      "--network",
      NETWORK,
      "--tmpfs",
      "/tmp:rw,exec,nosuid,size=512m",
      "-v",
      `${workspace}:${WORKSPACE_MOUNT}`,
      "-w",
      WORKSPACE_MOUNT,
    ];
    for (const [containerPort, hostPort] of Object.entries(ports)) {
      args.push("-p", `127.0.0.1:${hostPort}:${containerPort}`);
      args.push("--label", `agent-builder.port.${containerPort}=${hostPort}`);
    }
    args.push(IMAGE);
    const created = await docker(args, { timeoutMs: 60_000 });
    if (created.code === 0) {
      const record: RuntimeRecord = {
        containerName: name,
        ports,
        previewUrl: null,
      };
      writeRuntime(projectId, record);
      return record;
    }
    lastError = created.stderr.trim() || lastError;
    await docker(["rm", "-f", name], { timeoutMs: 20_000 });
  }
  console.error("[agent-builder sandbox]", lastError);
  throw new HttpError(503, "启动 Project 容器失败");
}

export async function ensureProjectContainer(
  userId: string,
  projectId: string,
  onStatus?: StatusListener
): Promise<void> {
  const workspace = await ensureWorkspaceDir(userId, projectId);
  await ensureImage(onStatus);
  await ensureNetwork();
  await startContainer(userId, projectId, workspace, onStatus);
}

async function refreshPreview(
  projectId: string,
  signal?: AbortSignal
): Promise<string | null> {
  const runtime = readRuntime(projectId);
  if (!runtime) return null;
  const scanned = await docker(
    ["exec", "-i", runtime.containerName, "node", "--input-type=module", "-"],
    { input: PORT_SCAN_SCRIPT, timeoutMs: 15_000, signal }
  );
  if (scanned.code !== 0) return runtime.previewUrl;
  const listening = new Set(
    scanned.stdout
      .split(",")
      .map((item) => Number(item))
      .filter((port) => Number.isInteger(port) && port > 0)
  );
  const matched = PREVIEW_PORTS.find((port) => listening.has(port));
  const previewUrl = matched
    ? `http://127.0.0.1:${runtime.ports[String(matched)]}`
    : null;
  writeRuntime(projectId, { ...runtime, previewUrl });
  return previewUrl;
}

export type PreviewServerState = {
  running: boolean;
  previewUrl: string | null;
};

const previewStarts = new Map<string, Promise<PreviewServerState>>();

function wait(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal?.aborted) {
      resolve();
      return;
    }
    const timer = setTimeout(finish, ms);
    function finish() {
      clearTimeout(timer);
      signal?.removeEventListener("abort", finish);
      resolve();
    }
    signal?.addEventListener("abort", finish, { once: true });
  });
}

function previewFailure(output: string, fallback: string): string {
  const line = output
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean)
    .at(-1);
  if (!line) return fallback;
  return line.length > 180 ? `${line.slice(0, 180)}…` : line;
}

async function runningRuntime(projectId: string): Promise<RuntimeRecord | null> {
  const runtime = readRuntime(projectId);
  if (!runtime) return null;
  const inspected = await inspectContainer(runtime.containerName);
  if (!inspected?.running) {
    if (runtime.previewUrl) {
      writeRuntime(projectId, { ...runtime, previewUrl: null });
    }
    return null;
  }
  return readRuntime(projectId) ?? runtime;
}

export async function readPreviewServer(
  projectId: string
): Promise<PreviewServerState> {
  if (!UUID_RE.test(projectId)) return { running: false, previewUrl: null };
  const runtime = await runningRuntime(projectId);
  if (!runtime) return { running: false, previewUrl: null };
  const previewUrl = await refreshPreview(projectId);
  return { running: Boolean(previewUrl), previewUrl };
}

async function signalPreviewProcesses(
  containerName: string,
  signalName: "SIGINT" | "SIGTERM",
  signal?: AbortSignal
): Promise<void> {
  await docker(
    [
      "exec",
      "-i",
      "-e",
      `AGENT_STOP_SIGNAL=${signalName}`,
      containerName,
      "node",
      "--input-type=module",
      "-",
    ],
    { input: STOP_PREVIEW_SCRIPT, timeoutMs: 15_000, signal }
  );
}

async function launchPreviewServer(input: {
  userId: string;
  projectId: string;
  signal?: AbortSignal;
}): Promise<PreviewServerState> {
  const current = await readPreviewServer(input.projectId).catch(() => null);
  if (current?.running && current.previewUrl) return current;
  const result = await executeProjectCommand({
    userId: input.userId,
    projectId: input.projectId,
    command: "pnpm dev",
    background: true,
    signal: input.signal,
  });
  if (result.previewUrl) {
    return { running: true, previewUrl: result.previewUrl };
  }
  if (result.status === "exited") {
    throw new HttpError(400, previewFailure(result.output, "开发服务启动失败"));
  }
  const deadline = Date.now() + 25_000;
  while (Date.now() < deadline) {
    if (input.signal?.aborted) break;
    await wait(500, input.signal);
    const previewUrl = await refreshPreview(input.projectId, input.signal).catch(
      () => null
    );
    if (previewUrl) return { running: true, previewUrl };
  }
  throw new HttpError(504, previewFailure(result.output, "开发服务尚未就绪"));
}

export function startPreviewServer(input: {
  userId: string;
  projectId: string;
  signal?: AbortSignal;
}): Promise<PreviewServerState> {
  const existing = previewStarts.get(input.projectId);
  if (existing) return existing;
  const task = launchPreviewServer(input).finally(() => {
    if (previewStarts.get(input.projectId) === task) {
      previewStarts.delete(input.projectId);
    }
  });
  previewStarts.set(input.projectId, task);
  return task;
}

export async function stopPreviewServer(input: {
  userId: string;
  projectId: string;
  signal?: AbortSignal;
}): Promise<PreviewServerState> {
  assertId(input.userId, "用户");
  assertId(input.projectId, "Project");
  const runtime = readRuntime(input.projectId);
  if (!runtime) return { running: false, previewUrl: null };
  const inspected = await inspectContainer(runtime.containerName);
  if (!inspected?.running) {
    writeRuntime(input.projectId, { ...runtime, previewUrl: null });
    return { running: false, previewUrl: null };
  }
  await signalPreviewProcesses(runtime.containerName, "SIGINT", input.signal);
  await wait(1200, input.signal);
  let previewUrl = await refreshPreview(input.projectId, input.signal).catch(
    () => runtime.previewUrl
  );
  if (previewUrl) {
    await signalPreviewProcesses(runtime.containerName, "SIGTERM", input.signal);
    await wait(800, input.signal);
    previewUrl = await refreshPreview(input.projectId, input.signal).catch(
      () => previewUrl
    );
  }
  return { running: Boolean(previewUrl), previewUrl };
}

function prefersBackground(command: string): boolean {
  return (
    /(?:^|[;&|]\s*)(?:pnpm|npm|yarn|bun)\s+(?:run\s+)?(?:dev|start|serve|preview|watch)\b/.test(
      command
    ) ||
    /(?:^|[;&|]\s*)(?:next|vite|astro|nuxt)\s+(?:dev|preview)\b/.test(command)
  );
}

function timeoutFor(command: string, background: boolean): number {
  if (background) return 1_500;
  if (/\b(install|add|create|ci)\b/.test(command)) return 300_000;
  return 180_000;
}

async function withProjectLock<T>(
  projectId: string,
  task: () => Promise<T>
): Promise<T> {
  const previous = projectLocks.get(projectId) ?? Promise.resolve();
  let release: () => void = () => undefined;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const tail = previous.then(() => gate, () => gate);
  projectLocks.set(projectId, tail);
  await previous.catch(() => undefined);
  try {
    return await task();
  } finally {
    release();
    if (projectLocks.get(projectId) === tail) {
      projectLocks.delete(projectId);
    }
  }
}

export async function executeProjectCommand(input: {
  userId: string;
  projectId: string;
  command: string;
  background?: boolean;
  signal?: AbortSignal;
  onStatus?: StatusListener;
}): Promise<ProjectCommandResult> {
  const command = input.command.trim();
  if (!command) {
    throw new HttpError(400, "请输入命令");
  }
  if (command.length > 20_000 || command.includes("\0")) {
    throw new HttpError(400, "命令过长");
  }
  assertId(input.userId, "用户");
  assertId(input.projectId, "Project");

  return withProjectLock(input.projectId, async () => {
    await ensureProjectContainer(input.userId, input.projectId, input.onStatus);
    const runtime = readRuntime(input.projectId);
    if (!runtime) {
      throw new HttpError(503, "启动 Project 容器失败");
    }
    const background = input.background ?? prefersBackground(command);
    const timeoutMs = timeoutFor(command, background);
    const processId = randomBytes(8).toString("hex");
    input.onStatus?.(background ? "正在后台启动命令" : "正在执行命令");
    const executed = await docker(
      [
        "exec",
        "-i",
        "-e",
        `AGENT_ID=${processId}`,
        "-e",
        `AGENT_TIMEOUT_MS=${timeoutMs}`,
        "-e",
        `AGENT_CMD_B64=${Buffer.from(command, "utf8").toString("base64")}`,
        "-w",
        WORKSPACE_MOUNT,
        runtime.containerName,
        "node",
        "--input-type=module",
        "-",
      ],
      {
        input: RUNNER_SCRIPT,
        timeoutMs: timeoutMs + 20_000,
        signal: input.signal,
      }
    );
    const parsed = parseRunnerOutput(executed.stdout);
    if (!parsed) {
      if (input.signal?.aborted) {
        return {
          status: "exited",
          exitCode: null,
          output: "已取消",
          processId,
          pid: null,
          logPath: `.agent/procs/${processId}.log`,
          previewUrl: runtime.previewUrl,
        };
      }
      console.error("[agent-builder sandbox command]", executed.stderr);
      throw new HttpError(503, "命令执行失败");
    }
    const previewUrl = await refreshPreview(input.projectId, input.signal).catch(
      () => runtime.previewUrl
    );
    return {
      status: parsed.status,
      exitCode: parsed.exitCode,
      output: parsed.output,
      processId: parsed.id,
      pid: parsed.pid,
      logPath: parsed.logPath,
      previewUrl,
    };
  });
}

function parseRunnerOutput(stdout: string): {
  status: "exited" | "running";
  exitCode: number | null;
  output: string;
  id: string;
  pid: number | null;
  logPath: string | null;
} | null {
  const line = stdout.trim().split("\n").filter(Boolean).at(-1);
  if (!line) return null;
  try {
    const value = JSON.parse(line) as {
      status?: string;
      exitCode?: number | null;
      output?: string;
      id?: string;
      pid?: number;
      logPath?: string;
    };
    if (value.status !== "exited" && value.status !== "running") return null;
    return {
      status: value.status,
      exitCode:
        typeof value.exitCode === "number" ? value.exitCode : null,
      output: typeof value.output === "string" ? value.output : "",
      id: typeof value.id === "string" ? value.id : "",
      pid: typeof value.pid === "number" ? value.pid : null,
      logPath: typeof value.logPath === "string" ? value.logPath : null,
    };
  } catch {
    return null;
  }
}

export function formatCommandResult(result: ProjectCommandResult): string {
  const lines = [
    `status: ${result.status}`,
    `exitCode: ${result.exitCode ?? ""}`,
    `pid: ${result.pid ?? ""}`,
    `log: ${result.logPath ?? ""}`,
    `preview: ${result.previewUrl ?? ""}`,
    "---",
    result.output,
  ];
  return lines.join("\n");
}

function languageFor(filePath: string): string {
  const ext = path.extname(filePath).slice(1).toLowerCase();
  return LANG_BY_EXT[ext] ?? "text";
}

export async function listProjectFiles(
  userId: string,
  projectId: string
): Promise<ProjectFile[]> {
  let root: string;
  try {
    root = await ensureWorkspaceDir(userId, projectId);
  } catch {
    return [];
  }
  const files: ProjectFile[] = [];

  async function walk(dir: string, depth: number): Promise<void> {
    if (depth > 8 || files.length >= 400) return;
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (files.length >= 400) return;
      if (entry.name === "." || entry.name === "..") continue;
      const absolute = path.join(dir, entry.name);
      const info = await lstat(absolute);
      if (info.isSymbolicLink()) continue;
      if (info.isDirectory()) {
        if (SKIP_DIRS.has(entry.name)) continue;
        await walk(absolute, depth + 1);
        continue;
      }
      if (!info.isFile()) continue;
      const relative = path.relative(root, absolute).split(path.sep).join("/");
      if (relative.startsWith("..")) continue;
      let content = "";
      if (info.size <= 200_000) {
        const bytes = await readFile(absolute);
        if (!bytes.subarray(0, 8000).includes(0)) {
          content = bytes.toString("utf8");
        } else {
          content = "二进制文件";
        }
      } else {
        content = "文件较大，请在终端中查看";
      }
      files.push({
        path: relative,
        language: languageFor(relative),
        content,
      });
    }
  }

  try {
    await walk(root, 0);
  } catch {
    return files;
  }
  files.sort((a, b) => a.path.localeCompare(b.path));
  return files;
}

function workspaceChildPath(root: string, relative: string): string {
  const cleaned = relative.replace(/\\/g, "/").trim().replace(/^\/+|\/+$/g, "");
  if (!cleaned) return root;
  const parts = cleaned.split("/");
  if (parts.some((part) => !part || part === "." || part === "..")) {
    throw new HttpError(400, "路径无效");
  }
  const target = path.resolve(root, ...parts);
  assertInside(root, target);
  return target;
}

function toWorkspaceEntry(root: string, absolute: string, name: string, kind: WorkspaceEntry["kind"]): WorkspaceEntry {
  const relative = path.relative(root, absolute).split(path.sep).join("/");
  return { name, path: relative, kind };
}

/** Lists one workspace directory. Children load when that directory is opened. */
export async function listWorkspaceEntries(
  userId: string,
  projectId: string,
  relativeDir = ""
): Promise<WorkspaceEntry[]> {
  const root = realpathSync(await ensureWorkspaceDir(userId, projectId));
  const dir = workspaceChildPath(root, relativeDir);
  const realDir = realpathSync(dir);
  if (realDir !== root) assertInside(root, realDir);
  const info = await lstat(realDir);
  if (!info.isDirectory()) {
    throw new HttpError(400, "路径不是目录");
  }
  const entries = await readdir(realDir, { withFileTypes: true });
  const items: WorkspaceEntry[] = [];
  for (const entry of entries) {
    if (entry.name === "." || entry.name === "..") continue;
    const absolute = path.join(realDir, entry.name);
    const stat = await lstat(absolute);
    if (stat.isSymbolicLink()) continue;
    if (stat.isDirectory()) {
      items.push(toWorkspaceEntry(root, absolute, entry.name, "directory"));
    } else if (stat.isFile()) {
      items.push(toWorkspaceEntry(root, absolute, entry.name, "file"));
    }
  }
  items.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === "directory" ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
  return items;
}

export async function readWorkspaceFile(
  userId: string,
  projectId: string,
  relativePath: string
): Promise<ProjectFile> {
  const root = realpathSync(await ensureWorkspaceDir(userId, projectId));
  const target = workspaceChildPath(root, relativePath);
  const real = realpathSync(target);
  assertInside(root, real);
  const info = await lstat(real);
  if (!info.isFile()) {
    throw new HttpError(400, "路径不是文件");
  }
  let content = "";
  if (info.size <= 200_000) {
    const bytes = await readFile(real);
    content = bytes.subarray(0, 8000).includes(0)
      ? "二进制文件"
      : bytes.toString("utf8");
  } else {
    content = "文件较大，请在终端中查看";
  }
  const filePath = path.relative(root, real).split(path.sep).join("/");
  return { path: filePath, language: languageFor(filePath), content };
}

const SEARCH_MATCH_LIMIT = 5000;

export async function searchWorkspaceEntries(
  userId: string,
  projectId: string,
  query: string
): Promise<{ entries: WorkspaceEntry[]; truncated: boolean }> {
  const needle = query.trim().toLowerCase();
  if (!needle) return { entries: [], truncated: false };
  const root = realpathSync(await ensureWorkspaceDir(userId, projectId));
  const entries: WorkspaceEntry[] = [];
  let truncated = false;

  async function walk(dir: string): Promise<void> {
    if (truncated) return;
    const children = await readdir(dir, { withFileTypes: true });
    for (const entry of children) {
      if (truncated) return;
      if (entry.name === "." || entry.name === "..") continue;
      const absolute = path.join(dir, entry.name);
      const stat = await lstat(absolute);
      if (stat.isSymbolicLink()) continue;
      const kind: WorkspaceEntry["kind"] | null = stat.isDirectory()
        ? "directory"
        : stat.isFile()
          ? "file"
          : null;
      if (!kind) continue;
      const item = toWorkspaceEntry(root, absolute, entry.name, kind);
      if (item.path.toLowerCase().includes(needle)) {
        entries.push(item);
        if (entries.length >= SEARCH_MATCH_LIMIT) {
          truncated = true;
          return;
        }
      }
      if (kind === "directory") await walk(absolute);
    }
  }

  await walk(root);
  entries.sort((a, b) => a.path.localeCompare(b.path));
  return { entries, truncated };
}

export async function destroyProjectSandbox(
  userId: string,
  projectId: string
): Promise<void> {
  assertId(userId, "用户");
  assertId(projectId, "Project");
  const name = containerName(projectId);
  const removed = await docker(["rm", "-f", name], { timeoutMs: 30_000 });
  const removable =
    removed.code === 0 ||
    /no such container|no such object|cannot connect to the docker daemon|is the docker daemon running/i.test(
      removed.stderr
    );
  if (!removable) {
    throw new HttpError(503, "停止 Project 容器失败");
  }
  const workspace = projectWorkspacePath(userId, projectId);
  if (existsSync(workspace)) {
    const root = realpathSync(sandboxRoot());
    const real = realpathSync(workspace);
    assertInside(root, real);
    await rm(real, { recursive: true, force: true });
  }
  rmSync(runtimePath(projectId), { force: true });
}
