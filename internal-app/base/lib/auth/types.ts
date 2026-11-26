export type UserRole = "admin" | "user";

export interface PublicUser {
  id: string;
  username: string;
  role: UserRole;
  isBuiltIn: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UsersPagePayload {
  users: PublicUser[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export const BUILT_IN_ADMIN_USERNAME = "admin";
export const BUILT_IN_ADMIN_INITIAL_PASSWORD = "admin";
export const DEFAULT_USER_PASSWORD = "user12345";
