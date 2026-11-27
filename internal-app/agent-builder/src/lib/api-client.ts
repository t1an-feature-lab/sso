import type {
  AvailableModelOption,
  ChatImageInput,
  ChatSessionDetail,
  ChatSessionSummary,
  CreateModelConfigInput,
  ModelConfigDto,
  ChatStepPart,
  ChatToolPart,
  PreviewServerStatus,
  ProjectCommandResult,
  ProjectFile,
  ProjectSummary,
  WorkspaceEntry,
  PublicUser,
  UpdateModelConfigInput,
  UserRole,
  UsersPagePayload,
} from "./types";

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(
      typeof data?.error === "string"
        ? data.error
        : `请求失败 (${response.status})`
    );
  }
  return data as T;
}

export type StreamEventData = {
  message?: string;
  steps?: ChatStepPart[];
  delta?: string;
  tool?: ChatToolPart;
  files?: ProjectFile[];
  previewUrl?: string | null;
  session?: ChatSessionDetail;
};

async function readEventStream(
  url: string,
  init: RequestInit,
  onEvent: (event: string, data: StreamEventData) => void
): Promise<void> {
  const response = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
      ...(init.headers ?? {}),
    },
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(
      typeof data?.error === "string"
        ? data.error
        : `请求失败 (${response.status})`
    );
  }
  if (!response.body) {
    throw new Error("生成失败");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const chunks = buffer.split("\n\n");
    buffer = chunks.pop() ?? "";
    for (const chunk of chunks) {
      const lines = chunk.split("\n");
      let event = "message";
      const dataLines: string[] = [];
      for (const line of lines) {
        if (line.startsWith("event:")) event = line.slice(6).trim();
        else if (line.startsWith("data:")) dataLines.push(line.slice(5).trim());
      }
      if (dataLines.length === 0) continue;
      const data = JSON.parse(dataLines.join("\n")) as StreamEventData;
      onEvent(event, data);
    }
  }
}

export const apiClient = {
  login(input: {
    username: string;
    password: string;
  }): Promise<{ user: PublicUser; registered: boolean }> {
    return request("/api/auth/login", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  logout(): Promise<{ ok: true }> {
    return request("/api/auth/logout", {
      method: "POST",
    });
  },

  changePassword(input: {
    currentPassword: string;
    newPassword: string;
    confirmPassword: string;
  }): Promise<{ ok: true }> {
    return request("/api/auth/change-password", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  resetOwnPassword(): Promise<{ ok: true; password: string }> {
    return request("/api/auth/reset-password", {
      method: "POST",
    });
  },

  async updateProfile(formData: FormData): Promise<{ user: PublicUser }> {
    const response = await fetch("/api/auth/profile", {
      method: "PATCH",
      body: formData,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(
        typeof data?.error === "string"
          ? data.error
          : `请求失败 (${response.status})`
      );
    }
    return data as { user: PublicUser };
  },

  listUsers(params?: {
    page?: number;
    pageSize?: number;
  }): Promise<UsersPagePayload> {
    const qs = new URLSearchParams();
    if (params?.page !== undefined) qs.set("page", String(params.page));
    if (params?.pageSize !== undefined) {
      qs.set("pageSize", String(params.pageSize));
    }
    const query = qs.toString();
    return request<UsersPagePayload>(
      `/api/admin/users${query ? `?${query}` : ""}`
    );
  },

  updateUserRole(
    userId: string,
    role: UserRole
  ): Promise<{ user: PublicUser }> {
    return request(`/api/admin/users/${encodeURIComponent(userId)}/role`, {
      method: "PATCH",
      body: JSON.stringify({ role }),
    });
  },

  resetUserPassword(
    userId: string
  ): Promise<{ user: PublicUser; password: string }> {
    return request(
      `/api/admin/users/${encodeURIComponent(userId)}/reset-password`,
      {
        method: "POST",
      }
    );
  },

  deleteUser(userId: string): Promise<{ ok: true }> {
    return request(`/api/admin/users/${encodeURIComponent(userId)}`, {
      method: "DELETE",
    });
  },

  listModelConfigs(): Promise<{ models: ModelConfigDto[] }> {
    return request("/api/admin/models");
  },

  createModelConfig(
    input: CreateModelConfigInput
  ): Promise<{ model: ModelConfigDto }> {
    return request("/api/admin/models", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  updateModelConfig(
    modelId: string,
    input: UpdateModelConfigInput
  ): Promise<{ model: ModelConfigDto }> {
    return request(`/api/admin/models/${encodeURIComponent(modelId)}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    });
  },

  deleteModelConfig(modelId: string): Promise<{ ok: true }> {
    return request(`/api/admin/models/${encodeURIComponent(modelId)}`, {
      method: "DELETE",
    });
  },

  revealModelConfigApiKey(modelId: string): Promise<{ apiKey: string }> {
    return request(`/api/admin/models/${encodeURIComponent(modelId)}/secret`, {
      cache: "no-store",
    });
  },

  listAvailableModels(): Promise<{ models: AvailableModelOption[] }> {
    return request("/api/models");
  },

  setDefaultModel(modelId: string): Promise<{ model: AvailableModelOption }> {
    return request("/api/models/default", {
      method: "PATCH",
      body: JSON.stringify({ modelId }),
    });
  },

  listProjects(): Promise<{ projects: ProjectSummary[] }> {
    return request("/api/projects");
  },

  createProject(input: {
    name: string;
    description?: string;
  }): Promise<{ project: ProjectSummary }> {
    return request("/api/projects", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  updateProject(
    projectId: string,
    input: {
      name: string;
      description?: string;
    }
  ): Promise<{ project: ProjectSummary }> {
    return request(`/api/projects/${encodeURIComponent(projectId)}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    });
  },

  deleteProject(projectId: string): Promise<{ ok: true }> {
    return request(`/api/projects/${encodeURIComponent(projectId)}`, {
      method: "DELETE",
    });
  },

  listSessions(): Promise<{ sessions: ChatSessionSummary[] }> {
    return request("/api/sessions");
  },

  createSession(
    prompt?: string,
    projectId?: string,
    images: ChatImageInput[] = []
  ): Promise<{ session: ChatSessionDetail }> {
    return request("/api/sessions", {
      method: "POST",
      body: JSON.stringify({ prompt: prompt ?? "", projectId, images }),
    });
  },

  getSession(sessionId: string): Promise<{ session: ChatSessionDetail }> {
    return request(`/api/sessions/${encodeURIComponent(sessionId)}`);
  },

  streamSession(
    sessionId: string,
    input: {
      content?: string;
      images?: ChatImageInput[];
      modelId?: string | null;
      continueExisting?: boolean;
    },
    onEvent: (event: string, data: StreamEventData) => void,
    signal?: AbortSignal
  ): Promise<void> {
    return readEventStream(
      `/api/sessions/${encodeURIComponent(sessionId)}/messages`,
      {
        method: "POST",
        body: JSON.stringify({
          content: input.content ?? "",
          images: input.images ?? [],
          modelId: input.modelId,
          continue: input.continueExisting === true,
        }),
        signal,
      },
      onEvent
    );
  },

  listWorkspaceEntries(
    projectId: string,
    dir = ""
  ): Promise<{ entries: WorkspaceEntry[] }> {
    const params = new URLSearchParams();
    if (dir) params.set("dir", dir);
    const query = params.toString();
    return request(
      `/api/projects/${encodeURIComponent(projectId)}/files${query ? `?${query}` : ""}`
    );
  },

  searchWorkspaceEntries(
    projectId: string,
    queryText: string
  ): Promise<{ entries: WorkspaceEntry[]; truncated: boolean }> {
    const params = new URLSearchParams({ q: queryText });
    return request(
      `/api/projects/${encodeURIComponent(projectId)}/files?${params.toString()}`
    );
  },

  searchMentionableFiles(
    projectId: string,
    queryText: string,
    signal?: AbortSignal
  ): Promise<{ entries: WorkspaceEntry[] }> {
    const params = new URLSearchParams({ mention: "1" });
    if (queryText) params.set("q", queryText);
    return request(
      `/api/projects/${encodeURIComponent(projectId)}/files?${params.toString()}`,
      { signal }
    );
  },

  readWorkspaceFile(
    projectId: string,
    filePath: string
  ): Promise<{ file: ProjectFile }> {
    const params = new URLSearchParams({ file: filePath });
    return request(
      `/api/projects/${encodeURIComponent(projectId)}/files?${params.toString()}`
    );
  },

  runProjectCommand(
    projectId: string,
    command: string
  ): Promise<{
    result: ProjectCommandResult;
    files: ProjectFile[];
    previewUrl: string | null;
  }> {
    return request(`/api/projects/${encodeURIComponent(projectId)}/commands`, {
      method: "POST",
      body: JSON.stringify({ command }),
    });
  },

  getPreviewServer(projectId: string): Promise<PreviewServerStatus> {
    return request(`/api/projects/${encodeURIComponent(projectId)}/preview`);
  },

  controlPreviewServer(
    projectId: string,
    action: "start" | "stop"
  ): Promise<PreviewServerStatus> {
    return request(`/api/projects/${encodeURIComponent(projectId)}/preview`, {
      method: "POST",
      body: JSON.stringify({ action }),
    });
  },

  ensurePreviewFrame(
    projectId: string,
    upstream: string
  ): Promise<{ origin: string }> {
    const params = new URLSearchParams({ upstream });
    return request(
      `/api/projects/${encodeURIComponent(projectId)}/preview-proxy?${params.toString()}`
    );
  },

  renameSession(
    sessionId: string,
    title: string
  ): Promise<{ session: ChatSessionSummary }> {
    return request(`/api/sessions/${encodeURIComponent(sessionId)}`, {
      method: "PATCH",
      body: JSON.stringify({ title }),
    });
  },

  deleteSession(sessionId: string): Promise<{ ok: true }> {
    return request(`/api/sessions/${encodeURIComponent(sessionId)}`, {
      method: "DELETE",
    });
  },

  openProjectTerminal(
    projectId: string,
    cols: number,
    rows: number
  ): Promise<{ sessionId: string }> {
    return request(`/api/projects/${encodeURIComponent(projectId)}/terminal`, {
      method: "POST",
      body: JSON.stringify({ cols, rows }),
    });
  },

  writeProjectTerminal(
    projectId: string,
    sessionId: string,
    body: { data?: string; cols?: number; rows?: number }
  ): Promise<{ ok: true }> {
    return request(
      `/api/projects/${encodeURIComponent(projectId)}/terminal/${sessionId}`,
      {
        method: "POST",
        body: JSON.stringify(body),
      }
    );
  },

  syncProjectSnapshot(
    projectId: string
  ): Promise<{ files: ProjectFile[]; previewUrl: string | null }> {
    return request(
      `/api/projects/${encodeURIComponent(projectId)}/files?snapshot=1`
    );
  },
};
