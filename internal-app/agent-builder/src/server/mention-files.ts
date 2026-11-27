import { spawn } from "node:child_process";
import { existsSync, rmSync, writeFileSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import type { WorkspaceEntry } from "@/lib/types";

const MENTION_LIMIT = 50;
const CACHE_MS = 1000;
const STDOUT_CAP = 4_000_000;

type GitOutput = {
  code: number;
  stdout: string;
  stderr: string;
  truncated: boolean;
};

const fileCache = new Map<string, { at: number; files: string[] }>();
const pendingList = new Map<string, Promise<string[]>>();
let emptyGitDirReady: Promise<string> | null = null;
let nonRepoQueue: Promise<unknown> = Promise.resolve();

function enqueueNonRepo<T>(task: () => Promise<T>): Promise<T> {
  const run = nonRepoQueue.then(task, task);
  nonRepoQueue = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

function runtimeDir(): string {
  return path.resolve(process.cwd(), "storage", "runtime");
}

function runGit(
  args: string[],
  cwd: string,
  env: NodeJS.ProcessEnv
): Promise<GitOutput> {
  return new Promise((resolve, reject) => {
    const child = spawn("git", args, {
      cwd,
      env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    let stdoutLen = 0;
    let stderrLen = 0;
    let truncated = false;
    const timer = setTimeout(() => child.kill("SIGTERM"), 10_000);
    child.stdout.on("data", (chunk: Buffer) => {
      stdoutLen += chunk.length;
      if (stdoutLen <= STDOUT_CAP) stdout.push(chunk);
      else {
        truncated = true;
        child.kill("SIGTERM");
      }
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderrLen += chunk.length;
      if (stderrLen <= 64_000) stderr.push(chunk);
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({
        code: truncated ? 0 : (code ?? 1),
        stdout: Buffer.concat(stdout).toString("utf8"),
        stderr: Buffer.concat(stderr).toString("utf8"),
        truncated,
      });
    });
  });
}

function gitEnv(isolatedConfig: string | null): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    GIT_TERMINAL_PROMPT: "0",
  };
  if (isolatedConfig) {
    env.GIT_CONFIG_GLOBAL = isolatedConfig;
    env.GIT_CONFIG_SYSTEM = isolatedConfig;
    env.GIT_CONFIG_NOSYSTEM = "1";
  }
  return env;
}

async function ensureEmptyGitDir(): Promise<string> {
  if (!emptyGitDirReady) {
    emptyGitDirReady = (async () => {
      const dir = path.join(runtimeDir(), "mention-git");
      const gitDir = path.join(dir, ".git");
      const configFile = path.join(runtimeDir(), "mention-gitconfig");
      await mkdir(dir, { recursive: true });
      if (!existsSync(configFile)) writeFileSync(configFile, "");
      if (!existsSync(path.join(gitDir, "HEAD"))) {
        const created = await runGit(
          ["init", "-q", "--template=", dir],
          dir,
          gitEnv(configFile)
        );
        if (created.code !== 0 || !existsSync(path.join(gitDir, "HEAD"))) {
          throw new Error(created.stderr.trim() || "git init failed");
        }
      }
      return gitDir;
    })().catch((error) => {
      emptyGitDirReady = null;
      throw error;
    });
  }
  return emptyGitDirReady;
}

function splitGitPaths(stdout: string, truncated: boolean): string[] {
  if (!stdout) return [];
  const parts = stdout.split("\0").filter((part) => part.length > 0);
  if (truncated) parts.pop();
  return parts;
}

function isSafeRelative(filePath: string): boolean {
  if (!filePath || path.isAbsolute(filePath)) return false;
  const parts = filePath.split("/");
  return parts.every((part) => part.length > 0 && part !== "." && part !== "..");
}

async function listVisibleFiles(root: string): Promise<string[]> {
  const cached = fileCache.get(root);
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.files;
  const existing = pendingList.get(root);
  if (existing) return existing;

  const task = (async () => {
    const projectGit = path.join(root, ".git");
    const hasRepo = existsSync(projectGit);
    const gitDir = hasRepo ? projectGit : await ensureEmptyGitDir();
    const isolatedConfig = hasRepo
      ? null
      : path.join(runtimeDir(), "mention-gitconfig");
    const args = [
      "-c",
      "safe.directory=*",
      "--git-dir",
      gitDir,
      "--work-tree",
      root,
      "ls-files",
      "--cached",
      "--others",
      "--exclude-standard",
      "-z",
    ];
    const listed = await (hasRepo
      ? runGit(args, root, gitEnv(null))
      : enqueueNonRepo(() => {
          const indexFile = path.join(runtimeDir(), "mention-empty-index");
          rmSync(indexFile, { force: true });
          const env = gitEnv(isolatedConfig);
          env.GIT_INDEX_FILE = indexFile;
          return runGit(args, root, env);
        }));
    if (listed.code !== 0) {
      throw new Error(listed.stderr.trim() || "git ls-files failed");
    }
    const files = splitGitPaths(listed.stdout, listed.truncated).filter(
      (file) =>
        isSafeRelative(file) && file !== ".git" && !file.startsWith(".git/")
    );
    fileCache.set(root, { at: Date.now(), files });
    return files;
  })().finally(() => {
    pendingList.delete(root);
  });

  pendingList.set(root, task);
  return task;
}

function toEntries(files: string[]): WorkspaceEntry[] {
  const fileSet = new Set<string>();
  const directories = new Set<string>();
  for (const file of files) {
    fileSet.add(file);
    const parts = file.split("/");
    for (let index = 1; index < parts.length; index += 1) {
      directories.add(parts.slice(0, index).join("/"));
    }
  }

  const entries: WorkspaceEntry[] = [];
  for (const directory of directories) {
    if (fileSet.has(directory)) continue;
    entries.push({
      name: directory.slice(directory.lastIndexOf("/") + 1),
      path: directory,
      kind: "directory",
    });
  }
  for (const file of fileSet) {
    entries.push({
      name: file.slice(file.lastIndexOf("/") + 1),
      path: file,
      kind: "file",
    });
  }
  return entries;
}

function scoreEntry(entry: WorkspaceEntry, query: string): number {
  const depth = entry.path.split("/").length;
  if (!query) return 10_000 - depth;
  const pathText = entry.path.toLowerCase();
  const nameText = entry.name.toLowerCase();
  if (!pathText.includes(query)) return -1;
  let score = 200;
  if (nameText === query) score = 1000;
  else if (nameText.startsWith(query)) score = 800;
  else if (nameText.includes(query)) score = 600;
  else if (pathText.startsWith(query)) score = 400;
  return score - depth + (entry.kind === "directory" ? 5 : 0);
}

function rankEntries(entries: WorkspaceEntry[], query: string): WorkspaceEntry[] {
  return entries
    .map((entry) => ({ entry, score: scoreEntry(entry, query) }))
    .filter((item) => item.score >= 0)
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score;
      if (left.entry.kind !== right.entry.kind) {
        return left.entry.kind === "file" ? -1 : 1;
      }
      return left.entry.path.localeCompare(right.entry.path);
    })
    .slice(0, MENTION_LIMIT)
    .map((item) => item.entry);
}

/** Files and directories git would keep, using the project's ignore rules. */
export async function searchMentionableEntries(
  root: string,
  query: string
): Promise<WorkspaceEntry[]> {
  const files = await listVisibleFiles(root);
  return rankEntries(toEntries(files), query.trim().toLowerCase().slice(0, 200));
}
