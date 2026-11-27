import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { BUILT_IN_ADMIN_USERNAME, type PublicUser } from "@/lib/types";
import { db } from "./db";
import { HttpError } from "./http";

const PUBLIC_USER_SELECT = {
  id: true,
  username: true,
  role: true,
  isBuiltIn: true,
  avatarUpdatedAt: true,
  createdAt: true,
  updatedAt: true,
} as const;

function toPublicUser(user: {
  id: string;
  username: string;
  role: string;
  isBuiltIn: boolean;
  avatarUpdatedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): PublicUser {
  return {
    id: user.id,
    username: user.username,
    role: user.role === "admin" ? "admin" : "user",
    isBuiltIn: Boolean(
      user.isBuiltIn || user.username === BUILT_IN_ADMIN_USERNAME
    ),
    avatarUrl: user.avatarUpdatedAt
      ? `/api/users/${encodeURIComponent(user.id)}/avatar?v=${user.avatarUpdatedAt.getTime()}`
      : null,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}

export async function getUserProfileStats(userId: string): Promise<{
  projectCount: number;
  sessionCount: number;
}> {
  const [projectCount, sessionCount] = await Promise.all([
    db.project.count({ where: { userId } }),
    db.chatSession.count({ where: { userId } }),
  ]);
  return { projectCount, sessionCount };
}

export async function getUserAvatar(
  userId: string
): Promise<{ data: Uint8Array; mime: string } | null> {
  const row = await db.user.findUnique({
    where: { id: userId },
    select: { avatarData: true, avatarMime: true },
  });
  if (!row?.avatarData || !row.avatarMime) return null;
  return { data: row.avatarData, mime: row.avatarMime };
}

export async function updateOwnProfile(
  userId: string,
  input: {
    username: string;
    avatar?: { data: Uint8Array; mime: string } | null;
    removeAvatar?: boolean;
  }
): Promise<PublicUser> {
  const username = input.username.trim();
  if (!username || username.length > 64 || /\p{Cc}/u.test(username)) {
    throw new HttpError(400, "请输入 1–64 个字符的用户名，不能包含控制字符");
  }

  const existing = await db.user.findUnique({
    where: { id: userId },
    select: { id: true },
  });
  if (!existing) {
    throw new HttpError(404, "用户不存在");
  }

  try {
    const updated = await db.user.update({
      where: { id: userId },
      select: PUBLIC_USER_SELECT,
      data: {
        username,
        ...(input.avatar
          ? {
              avatarData: new Uint8Array(input.avatar.data),
              avatarMime: input.avatar.mime,
              avatarUpdatedAt: new Date(),
            }
          : input.removeAvatar
            ? {
                avatarData: null,
                avatarMime: null,
                avatarUpdatedAt: null,
              }
            : {}),
      },
    });
    return toPublicUser(updated);
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new HttpError(409, "该用户名已被使用");
    }
    throw error;
  }
}
