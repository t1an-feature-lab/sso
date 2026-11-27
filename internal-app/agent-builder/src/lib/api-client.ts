import type {
  AvailableModelOption,
  ChatSessionDetail,
  ChatSessionSummary,
  CreateModelConfigInput,
  ModelConfigDto,
  ProjectSummary,
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
    projectId?: string
  ): Promise<{ session: ChatSessionDetail }> {
    return request("/api/sessions", {
      method: "POST",
      body: JSON.stringify({ prompt: prompt ?? "", projectId }),
    });
  },

  getSession(sessionId: string): Promise<{ session: ChatSessionDetail }> {
    return request(`/api/sessions/${encodeURIComponent(sessionId)}`);
  },

  sendMessage(
    sessionId: string,
    content: string
  ): Promise<{ session: ChatSessionDetail }> {
    return request(`/api/sessions/${encodeURIComponent(sessionId)}/messages`, {
      method: "POST",
      body: JSON.stringify({ content }),
    });
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
};
