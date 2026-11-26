"use client";

import {
  ChevronsUpDownIcon,
  KeyRoundIcon,
  LogOutIcon,
  MonitorIcon,
  MoonIcon,
  PaletteIcon,
  RotateCcwIcon,
  SunIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useRef, useState } from "react";
import { toast } from "sonner";
import { useTheme } from "@/components/theme-provider";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm-dialog";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authApi } from "@/lib/auth/api-client";
import { DEFAULT_USER_PASSWORD, type PublicUser } from "@/lib/auth/types";
import type { ThemeMode } from "@/lib/theme";
import { UserAvatar } from "./user-avatar";

const THEME_LABELS: Record<ThemeMode, string> = {
  light: "亮色",
  dark: "暗色",
  system: "跟随系统",
};

export function UserAccountMenu({ user }: { user: PublicUser }) {
  const router = useRouter();
  const confirm = useConfirm();
  const { mode, setMode } = useTheme();
  const formId = useId();

  const [changeDialogOpen, setChangeDialogOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submittingPassword, setSubmittingPassword] = useState(false);
  const [busyAction, setBusyAction] = useState(false);
  const actionInFlight = useRef(false);

  const roleLabel = user.role === "admin" ? "管理员" : "普通用户";
  const canManagePassword = !user.isBuiltIn;

  function openChangePasswordDialog() {
    if (busyAction) return;
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setChangeDialogOpen(true);
  }

  async function handleChangePassword(event: React.FormEvent) {
    event.preventDefault();
    if (submittingPassword) return;

    if (!currentPassword) {
      toast.error("请输入当前密码");
      return;
    }
    if (newPassword.length < 5 || newPassword.length > 128) {
      toast.error("新密码长度需在 5 到 128 个字符之间");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("两次输入的新密码不一致");
      return;
    }

    setSubmittingPassword(true);
    try {
      await authApi.changePassword({
        currentPassword,
        newPassword,
        confirmPassword,
      });
      setChangeDialogOpen(false);
      toast.success("密码已更改");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "密码更改失败");
    } finally {
      setSubmittingPassword(false);
    }
  }

  async function handleResetOwnPassword() {
    if (actionInFlight.current) return;
    const confirmed = await confirm({
      title: "重置密码？",
      description: `你的密码将重置为 ${DEFAULT_USER_PASSWORD}，其他登录会话将失效，当前会话保持登录`,
      confirmLabel: "重置密码",
      cancelLabel: "取消",
    });
    if (!confirmed) return;

    actionInFlight.current = true;
    setBusyAction(true);
    try {
      const result = await authApi.resetOwnPassword();
      toast.success(`密码已重置为 ${result.password}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "密码重置失败");
    } finally {
      actionInFlight.current = false;
      setBusyAction(false);
    }
  }

  async function handleLogout() {
    if (actionInFlight.current) return;
    actionInFlight.current = true;
    setBusyAction(true);
    try {
      await authApi.logout();
      toast.success("已退出登录");
      router.replace("/login");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "退出登录失败");
      actionInFlight.current = false;
      setBusyAction(false);
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <button
              type="button"
              aria-label={`账号菜单 ${user.username}`}
              className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-sm text-foreground hover:bg-sidebar-accent cursor-pointer"
            />
          }
        >
          <UserAvatar username={user.username} size="md" />
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="bitable-cell-truncate text-sm leading-tight font-medium text-foreground">
              {user.username}
            </span>
            <span className="bitable-cell-truncate text-xs leading-tight text-muted-foreground">
              {roleLabel}
            </span>
          </div>
          <ChevronsUpDownIcon
            className="size-3.5 shrink-0 text-muted-foreground"
            aria-hidden="true"
          />
        </DropdownMenuTrigger>

        <DropdownMenuContent
          side="top"
          align="start"
          sideOffset={8}
          className="w-56"
        >
          <div className="flex items-center gap-2.5 px-2 py-2">
            <UserAvatar username={user.username} size="md" />
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="bitable-cell-truncate text-sm leading-tight font-medium text-foreground">
                {user.username}
              </span>
              <span className="bitable-cell-truncate text-xs leading-tight text-muted-foreground">
                {roleLabel}
              </span>
            </div>
          </div>

          <DropdownMenuSeparator />

          {canManagePassword && (
            <>
              <DropdownMenuItem
                disabled={busyAction}
                onClick={openChangePasswordDialog}
              >
                <KeyRoundIcon aria-hidden="true" />
                更改密码
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={busyAction}
                onClick={() => void handleResetOwnPassword()}
              >
                <RotateCcwIcon aria-hidden="true" />
                重置密码
              </DropdownMenuItem>
            </>
          )}

          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <PaletteIcon aria-hidden="true" />
              <span>主题：{THEME_LABELS[mode]}</span>
            </DropdownMenuSubTrigger>
            <DropdownMenuContent side="right" align="end" sideOffset={6} className="w-40">
              <DropdownMenuRadioGroup
                value={mode}
                onValueChange={(value) => {
                  if (
                    value === "light" ||
                    value === "dark" ||
                    value === "system"
                  ) {
                    setMode(value);
                  }
                }}
              >
                <DropdownMenuRadioItem value="light" closeOnClick>
                  <SunIcon aria-hidden="true" />
                  亮色
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="dark" closeOnClick>
                  <MoonIcon aria-hidden="true" />
                  暗色
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="system" closeOnClick>
                  <MonitorIcon aria-hidden="true" />
                  跟随系统
                </DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenuSub>

          <DropdownMenuSeparator />

          <DropdownMenuItem
            variant="destructive"
            disabled={busyAction}
            onClick={() => void handleLogout()}
          >
            <LogOutIcon aria-hidden="true" />
            退出登录
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {canManagePassword && (
        <Dialog
          open={changeDialogOpen}
          onOpenChange={(open) => {
            if (!submittingPassword) setChangeDialogOpen(open);
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>更改密码</DialogTitle>
            </DialogHeader>
            <form
              id={formId}
              onSubmit={handleChangePassword}
              className="flex flex-col gap-4"
            >
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={`${formId}-current`}>当前密码</Label>
                <Input
                  id={`${formId}-current`}
                  type="password"
                  autoComplete="current-password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  disabled={submittingPassword}
                  placeholder="请输入当前密码"
                  autoFocus
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={`${formId}-new`}>新密码</Label>
                <Input
                  id={`${formId}-new`}
                  type="password"
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  disabled={submittingPassword}
                  placeholder="5 到 128 位字符"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={`${formId}-confirm`}>确认新密码</Label>
                <Input
                  id={`${formId}-confirm`}
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={submittingPassword}
                  placeholder="请再次输入新密码"
                />
              </div>
            </form>
            <DialogFooter>
              <DialogClose
                render={
                  <Button variant="outline" disabled={submittingPassword} />
                }
              >
                取消
              </DialogClose>
              <Button
                type="submit"
                form={formId}
                disabled={submittingPassword}
              >
                {submittingPassword ? "保存中…" : "确认更改"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
