"use client";

import { useCallback, useRef, useState } from "react";
import { AlertDialog } from "@astryxdesign/core/AlertDialog";
import { Avatar } from "@astryxdesign/core/Avatar";
import { Badge } from "@astryxdesign/core/Badge";
import { Button } from "@astryxdesign/core/Button";
import { Card } from "@astryxdesign/core/Card";
import {
  DropdownMenu,
  DropdownMenuDivider,
  DropdownMenuItem,
} from "@astryxdesign/core/DropdownMenu";
import { EmptyState } from "@astryxdesign/core/EmptyState";
import { Icon } from "@astryxdesign/core/Icon";
import { Layout, LayoutContent } from "@astryxdesign/core/Layout";
import { Selector } from "@astryxdesign/core/Selector";
import { HStack, StackItem, VStack } from "@astryxdesign/core/Stack";
import { Table, pixel, proportional } from "@astryxdesign/core/Table";
import { Text } from "@astryxdesign/core/Text";
import { useAppToast } from "@/components/app-toast";
import { WorkspaceHeader } from "@/components/workspace-header";
import { apiClient } from "@/lib/api-client";
import {
  DEFAULT_USER_PASSWORD,
  type PublicUser,
  type UserRole,
  type UsersPagePayload,
} from "@/lib/types";

const ROLE_OPTIONS = [
  { value: "admin", label: "管理员" },
  { value: "user", label: "普通用户" },
];

const ROLE_LABELS: Record<UserRole, string> = {
  admin: "管理员",
  user: "普通用户",
};

function formatDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  const ss = String(date.getSeconds()).padStart(2, "0");
  return `${y}-${m}-${d} ${hh}:${mm}:${ss}`;
}

export function UsersPermissionTable({
  currentUser,
  initialData,
}: {
  currentUser: PublicUser;
  initialData: UsersPagePayload;
}) {
  const toast = useAppToast();
  const [pageData, setPageData] = useState<UsersPagePayload>(initialData);
  const [loadingPage, setLoadingPage] = useState(false);
  const [updatingRoleId, setUpdatingRoleId] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<{
    user: PublicUser;
    type: "reset" | "delete";
  } | null>(null);
  const [pendingAction, setPendingAction] = useState(false);
  const actionInFlight = useRef(false);

  const loadPage = useCallback(
    async (nextPage: number, pageSize: number) => {
      setLoadingPage(true);
      try {
        const data = await apiClient.listUsers({ page: nextPage, pageSize });
        setPageData(data);
      } catch (error) {
        toast({
          body: error instanceof Error ? error.message : "加载用户列表失败",
          type: "error",
          uniqueID: "users-load",
        });
      } finally {
        setLoadingPage(false);
      }
    },
    [toast]
  );

  async function handleRoleChange(target: PublicUser, nextRole: string) {
    if (
      target.isBuiltIn ||
      target.id === currentUser.id ||
      target.role === nextRole ||
      updatingRoleId === target.id ||
      (nextRole !== "admin" && nextRole !== "user")
    ) {
      return;
    }

    setUpdatingRoleId(target.id);
    try {
      const { user } = await apiClient.updateUserRole(target.id, nextRole);
      setPageData((prev) => ({
        ...prev,
        users: prev.users.map((item) => (item.id === user.id ? user : item)),
      }));
      toast({
        body: `已将 ${user.username} 调整为${ROLE_LABELS[user.role]}`,
        uniqueID: `user-role-${user.id}`,
      });
    } catch (error) {
      toast({
        body: error instanceof Error ? error.message : "修改角色失败",
        type: "error",
        uniqueID: `user-role-${target.id}`,
      });
    } finally {
      setUpdatingRoleId(null);
    }
  }

  function openAction(user: PublicUser, type: "reset" | "delete") {
    if (pendingAction || actionInFlight.current) return;
    if (user.isBuiltIn) return;
    if (type === "delete" && user.id === currentUser.id) return;
    setConfirmation({ user, type });
  }

  async function confirmAction() {
    if (!confirmation || pendingAction || actionInFlight.current) return;
    const { user, type } = confirmation;
    actionInFlight.current = true;
    setPendingAction(true);

    try {
      if (type === "reset") {
        const result = await apiClient.resetUserPassword(user.id);
        setConfirmation(null);
        toast({
          body: `已将 ${user.username} 的密码重置为 ${result.password}`,
          uniqueID: "user-action",
        });
      } else {
        await apiClient.deleteUser(user.id);
        setConfirmation(null);
        toast({
          body: `已删除用户 ${user.username}`,
          uniqueID: "user-action",
        });
        const remainingOnPage = pageData.users.length - 1;
        const targetPage =
          remainingOnPage === 0 && pageData.page > 1
            ? pageData.page - 1
            : pageData.page;
        await loadPage(targetPage, pageData.pageSize);
      }
    } catch (error) {
      toast({
        body:
          error instanceof Error
            ? error.message
            : type === "delete"
              ? "删除用户失败"
              : "重置密码失败",
        type: "error",
        uniqueID: "user-action",
      });
    } finally {
      actionInFlight.current = false;
      setPendingAction(false);
    }
  }

  return (
    <Layout
      height="fill"
      header={<WorkspaceHeader title="用户权限" />}
      content={
        <LayoutContent>
          <VStack gap={4}>
            <Card padding={0}>
              <Table
                aria-label="用户权限列表"
                data={pageData.users}
                rowIndexStart={(pageData.page - 1) * pageData.pageSize}
                rowCount={pageData.total}
                idKey="id"
                density="balanced"
                textOverflow="truncate"
                hasHover
                emptyState={
                  <EmptyState
                    title="暂无用户"
                    icon={<Icon icon="search" size="lg" />}
                  />
                }
                columns={[
                  {
                    key: "username",
                    header: "用户",
                    width: proportional(1.4, { minWidth: 220 }),
                    renderCell: (user) => (
                      <HStack gap={3} vAlign="center">
                        <Avatar
                          src={user.avatarUrl ?? undefined}
                          name={user.username}
                          size="md"
                          tooltip={false}
                        />
                        <StackItem size="fill">
                          <Text
                            type="label"
                            maxLines={1}
                            style={{ minInlineSize: 0, maxInlineSize: "15rem" }}
                          >
                            {user.username}
                          </Text>
                        </StackItem>
                      </HStack>
                    ),
                  },
                  {
                    key: "role",
                    header: "角色",
                    width: proportional(0.85, { minWidth: 160 }),
                    renderCell: (user) => {
                      const isSelf = user.id === currentUser.id;
                      const isSaving = updatingRoleId === user.id;
                      return (
                        <Selector
                          label={`${user.username} 的角色`}
                          isLabelHidden
                          value={user.role}
                          onChange={(value) => void handleRoleChange(user, value)}
                          options={ROLE_OPTIONS}
                          renderValue={(option) => (
                            <Badge
                              label={option.label}
                              variant={
                                option.value === "admin" ? "blue" : "neutral"
                              }
                            />
                          )}
                          isDisabled={user.isBuiltIn || isSelf || isSaving}
                          disabledMessage={
                            user.isBuiltIn
                              ? "内置 admin 角色不可修改"
                              : isSelf
                                ? "不能修改当前登录用户的角色"
                                : undefined
                          }
                          isLoading={isSaving}
                          variant="ghost"
                          size="sm"
                          width="100%"
                        />
                      );
                    },
                  },
                  {
                    key: "createdAt",
                    header: "注册时间",
                    width: proportional(1, { minWidth: 180 }),
                    renderCell: (user) => (
                      <Text
                        color="secondary"
                        maxLines={1}
                        hasTabularNumbers
                        style={{ minInlineSize: 0, maxInlineSize: "20rem" }}
                      >
                        <time dateTime={user.createdAt}>
                          {formatDateTime(user.createdAt)}
                        </time>
                      </Text>
                    ),
                  },
                  {
                    key: "actions",
                    header: "操作",
                    width: pixel(72),
                    align: "end",
                    renderCell: (user) =>
                      user.isBuiltIn ? null : (
                        <DropdownMenu
                          button={{
                            label: `操作 ${user.username}`,
                            icon: <Icon icon="moreHorizontal" />,
                            isIconOnly: true,
                            variant: "ghost",
                            size: "sm",
                            isDisabled: pendingAction,
                          }}
                          hasChevron={false}
                          alignment="end"
                          menuWidth={180}
                        >
                          <DropdownMenuItem
                            label="重置密码"
                            onClick={() => openAction(user, "reset")}
                          />
                          <DropdownMenuDivider />
                          <DropdownMenuItem
                            label="删除用户"
                            variant="destructive"
                            isDisabled={user.id === currentUser.id}
                            onClick={() => openAction(user, "delete")}
                          />
                        </DropdownMenu>
                      ),
                  },
                ]}
              />
            </Card>

            {pageData.totalPages > 1 && (
              <HStack hAlign="end" gap={2} vAlign="center">
                <Button
                  label="上一页"
                  variant="secondary"
                  size="sm"
                  isDisabled={loadingPage || pageData.page <= 1}
                  onClick={() =>
                    void loadPage(pageData.page - 1, pageData.pageSize)
                  }
                />
                <Text type="supporting" color="secondary" hasTabularNumbers>
                  第 {pageData.page} / {pageData.totalPages} 页
                </Text>
                <Button
                  label="下一页"
                  variant="secondary"
                  size="sm"
                  isDisabled={
                    loadingPage || pageData.page >= pageData.totalPages
                  }
                  onClick={() =>
                    void loadPage(pageData.page + 1, pageData.pageSize)
                  }
                />
              </HStack>
            )}
          </VStack>

          <AlertDialog
            isOpen={confirmation !== null}
            onOpenChange={(open) => {
              if (!actionInFlight.current && !open) setConfirmation(null);
            }}
            title={
              confirmation?.type === "delete"
                ? `删除用户「${confirmation.user.username}」？`
                : `重置「${confirmation?.user.username ?? ""}」的密码？`
            }
            description={
              confirmation?.type === "delete"
                ? "删除后该账号及其对话数据将被永久移除且无法恢复"
                : `该用户的密码将重置为 ${DEFAULT_USER_PASSWORD}，其他登录会话将失效`
            }
            actionLabel={
              confirmation?.type === "delete" ? "删除用户" : "重置密码"
            }
            cancelLabel="取消"
            onAction={() => void confirmAction()}
            isActionLoading={pendingAction}
          />
        </LayoutContent>
      }
    />
  );
}
