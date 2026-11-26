import type { PublicUser, UserRole, UsersPagePayload } from "./types";

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
      typeof data?.error === "string" ? data.error : `请求失败 (${response.status})`
    );
  }
  return data as T;
}

export const authApi = {
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
};
