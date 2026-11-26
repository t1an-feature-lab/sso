"use client";

import {
  ChevronLeftIcon,
  ChevronRightIcon,
  EllipsisIcon,
  RotateCcwIcon,
  Trash2Icon,
} from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import { UserAvatar } from "@/components/auth/user-avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { authApi } from "@/lib/auth/api-client";
import {
  DEFAULT_USER_PASSWORD,
  type PublicUser,
  type UserRole,
  type UsersPagePayload,
} from "@/lib/auth/types";
import { cn } from "@/lib/utils";

const ROLE_LABELS: Record<UserRole, string> = {
  admin: "管理员",
  user: "普通用户",
};

function formatDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "-";
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  const ss = String(date.getSeconds()).padStart(2, "0");
  return `${y}-${m}-${d} ${hh}:${mm}:${ss}`;
}

function getVisiblePages(current: number, total: number): (number | "ellipsis")[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, idx) => idx + 1);
  }
  const pages: (number | "ellipsis")[] = [1];
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  if (start > 2) pages.push("ellipsis");
  for (let p = start; p <= end; p += 1) {
    pages.push(p);
  }
  if (end < total - 1) pages.push("ellipsis");
  pages.push(total);
  return pages;
}

export function UsersPermissionView({
  currentUser,
  initialData,
}: {
  currentUser: PublicUser;
  initialData: UsersPagePayload;
}) {
  const confirm = useConfirm();
  const [pageData, setPageData] = useState<UsersPagePayload>(initialData);
  const [loadingPage, setLoadingPage] = useState(false);
  const [updatingRoleId, setUpdatingRoleId] = useState<string | null>(null);
  const [actingUserId, setActingUserId] = useState<string | null>(null);
  const actionInFlight = useRef(false);

  const loadPage = useCallback(async (nextPage: number, pageSize: number) => {
    setLoadingPage(true);
    try {
      const data = await authApi.listUsers({ page: nextPage, pageSize });
      setPageData(data);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "加载用户列表失败");
    } finally {
      setLoadingPage(false);
    }
  }, []);

  async function handleRoleChange(target: PublicUser, nextRole: UserRole) {
    if (
      target.isBuiltIn ||
      target.id === currentUser.id ||
      target.role === nextRole ||
      updatingRoleId === target.id
    ) {
      return;
    }

    setUpdatingRoleId(target.id);
    try {
      const { user } = await authApi.updateUserRole(target.id, nextRole);
      setPageData((prev) => ({
        ...prev,
        users: prev.users.map((item) => (item.id === user.id ? user : item)),
      }));
      toast.success(`已将 ${user.username} 调整为${ROLE_LABELS[user.role]}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "修改角色失败");
    } finally {
      setUpdatingRoleId(null);
    }
  }

  async function handleResetPassword(target: PublicUser) {
    if (actionInFlight.current || target.isBuiltIn) return;
    const confirmed = await confirm({
      title: `重置「${target.username}」的密码？`,
      description: `该用户的密码将重置为 ${DEFAULT_USER_PASSWORD}，其他登录会话将失效`,
      confirmLabel: "重置密码",
      cancelLabel: "取消",
    });
    if (!confirmed) return;

    actionInFlight.current = true;
    setActingUserId(target.id);
    try {
      const result = await authApi.resetUserPassword(target.id);
      toast.success(`已将 ${target.username} 的密码重置为 ${result.password}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "重置密码失败");
    } finally {
      actionInFlight.current = false;
      setActingUserId(null);
    }
  }

  async function handleDeleteUser(target: PublicUser) {
    if (
      actionInFlight.current ||
      target.isBuiltIn ||
      target.id === currentUser.id
    ) {
      return;
    }
    const confirmed = await confirm({
      title: `删除用户「${target.username}」？`,
      description: "删除后该账号将被永久移除且无法恢复",
      confirmLabel: "删除用户",
      cancelLabel: "取消",
      destructive: true,
    });
    if (!confirmed) return;

    actionInFlight.current = true;
    setActingUserId(target.id);
    try {
      await authApi.deleteUser(target.id);
      toast.success(`已删除用户 ${target.username}`);
      const remainingOnPage = pageData.users.length - 1;
      const targetPage =
        remainingOnPage === 0 && pageData.page > 1
          ? pageData.page - 1
          : pageData.page;
      await loadPage(targetPage, pageData.pageSize);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "删除用户失败");
    } finally {
      actionInFlight.current = false;
      setActingUserId(null);
    }
  }

  const visiblePages = getVisiblePages(pageData.page, pageData.totalPages);

  return (
    <div className="flex flex-col gap-4">
        <div className="overflow-hidden rounded-md border border-border bg-table-body">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="h-11 border-b border-border bg-table-header text-left text-sm font-normal text-foreground">
                  <th className="min-w-56 px-4 font-normal">用户</th>
                  <th className="w-44 px-3 font-normal">角色</th>
                  <th className="w-52 px-3 font-normal">注册时间</th>
                  <th
                    className="w-16 px-3 text-right font-normal"
                    aria-label="操作"
                  />
                </tr>
              </thead>
              <tbody className={cn(loadingPage && "opacity-60 transition-opacity")}>
                {pageData.users.length === 0 ? (
                  <tr>
                    <td
                      colSpan={4}
                      className="py-16 text-center text-sm text-muted-foreground"
                    >
                      暂无用户
                    </td>
                  </tr>
                ) : (
                  pageData.users.map((user, index) => {
                    const isSelf = user.id === currentUser.id;
                    const isLast = index === pageData.users.length - 1;
                    const roleDisabled =
                      user.isBuiltIn || isSelf || updatingRoleId === user.id;
                    const rowBusy = actingUserId === user.id;

                    return (
                      <tr
                        key={user.id}
                        className={cn(
                          "h-12 transition-colors hover:bg-muted/35",
                          !isLast && "border-b border-border"
                        )}
                      >
                        <td className="px-4 py-0">
                          <div className="flex min-w-0 items-center gap-2.5">
                            <UserAvatar username={user.username} size="sm" />
                            <span className="bitable-cell-truncate max-w-60 font-normal text-foreground">
                              {user.username}
                            </span>
                            {user.isBuiltIn && (
                              <Badge
                                variant="secondary"
                                className="h-5 shrink-0 px-1.5 text-[11px] font-normal"
                              >
                                内置
                              </Badge>
                            )}
                            {isSelf && (
                              <Badge
                                variant="outline"
                                className="h-5 shrink-0 px-1.5 text-[11px] font-normal"
                              >
                                当前账号
                              </Badge>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-0">
                          <Select
                            value={user.role}
                            disabled={roleDisabled}
                            onValueChange={(value) => {
                              if (value === "admin" || value === "user") {
                                void handleRoleChange(user, value);
                              }
                            }}
                          >
                            <SelectTrigger
                              size="sm"
                              aria-label={`${user.username} 的角色`}
                              className="w-32"
                            >
                              <SelectValue>
                                {ROLE_LABELS[user.role]}
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="admin">管理员</SelectItem>
                              <SelectItem value="user">普通用户</SelectItem>
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="px-3 py-0 tabular-nums text-foreground/80">
                          {formatDateTime(user.createdAt)}
                        </td>
                        <td className="px-3 py-0 text-right">
                          {user.isBuiltIn ? null : (
                            <DropdownMenu>
                              <DropdownMenuTrigger
                                render={
                                  <Button
                                    variant="ghost"
                                    size="icon-sm"
                                    disabled={rowBusy}
                                    aria-label={`操作 ${user.username}`}
                                    className="size-7 text-foreground"
                                  />
                                }
                              >
                                <EllipsisIcon
                                  className="size-4"
                                  aria-hidden="true"
                                />
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  disabled={rowBusy}
                                  onClick={() => void handleResetPassword(user)}
                                >
                                  <RotateCcwIcon aria-hidden="true" />
                                  重置密码
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  variant="destructive"
                                  disabled={rowBusy || isSelf}
                                  onClick={() => void handleDeleteUser(user)}
                                >
                                  <Trash2Icon aria-hidden="true" />
                                  删除用户
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        <nav
          aria-label="用户分页"
          className="flex items-center justify-end gap-1 px-1 text-sm text-muted-foreground"
        >
          <Button
              variant="outline"
              size="sm"
              disabled={loadingPage || pageData.page <= 1}
              onClick={() =>
                void loadPage(pageData.page - 1, pageData.pageSize)
              }
            >
              <ChevronLeftIcon className="size-4" aria-hidden="true" />
              上一页
            </Button>
            {visiblePages.map((item, idx) =>
              item === "ellipsis" ? (
                <span
                  key={`ellipsis-${idx}`}
                  className="px-2 text-muted-foreground"
                >
                  …
                </span>
              ) : (
                <Button
                  key={item}
                  variant={item === pageData.page ? "default" : "outline"}
                  size="sm"
                  disabled={loadingPage}
                  aria-current={item === pageData.page ? "page" : undefined}
                  onClick={() => {
                    if (item !== pageData.page) {
                      void loadPage(item, pageData.pageSize);
                    }
                  }}
                  className="min-w-8 px-2 tabular-nums"
                >
                  {item}
                </Button>
              )
            )}
            <Button
              variant="outline"
              size="sm"
              disabled={loadingPage || pageData.page >= pageData.totalPages}
              onClick={() =>
                void loadPage(pageData.page + 1, pageData.pageSize)
              }
            >
              下一页
              <ChevronRightIcon className="size-4" aria-hidden="true" />
            </Button>
        </nav>
      </div>
  );
}
