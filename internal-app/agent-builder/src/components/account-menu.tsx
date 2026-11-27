"use client";

import { useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Avatar } from "@astryxdesign/core/Avatar";
import { Button } from "@astryxdesign/core/Button";
import { Dialog, DialogHeader } from "@astryxdesign/core/Dialog";
import {
  DropdownMenu,
  DropdownMenuDivider,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSubMenu,
} from "@astryxdesign/core/DropdownMenu";
import { FormLayout } from "@astryxdesign/core/FormLayout";
import { Icon } from "@astryxdesign/core/Icon";
import { Layout, LayoutContent, LayoutFooter } from "@astryxdesign/core/Layout";
import { HStack, StackItem, VStack } from "@astryxdesign/core/Stack";
import { Text } from "@astryxdesign/core/Text";
import { TextInput } from "@astryxdesign/core/TextInput";
import { useImperativeAlertDialog } from "@astryxdesign/core/AlertDialog";
import type { ThemeMode } from "@astryxdesign/core/theme";
import {
  ArrowPathIcon,
  ArrowRightStartOnRectangleIcon,
  ComputerDesktopIcon,
  KeyIcon,
  MoonIcon,
  ShieldCheckIcon,
  SunIcon,
  SwatchIcon,
  UserCircleIcon,
} from "@heroicons/react/24/outline";
import { useColorMode } from "@/app/providers";
import { useAppToast } from "@/components/app-toast";
import { RobotIcon } from "@/components/robot-icon";
import { apiClient } from "@/lib/api-client";
import { DEFAULT_USER_PASSWORD, type PublicUser } from "@/lib/types";

const THEME_LABELS: Record<ThemeMode, string> = {
  light: "亮色",
  dark: "暗色",
  system: "跟随系统",
};

export function AccountMenu({ user }: { user: PublicUser }) {
  const router = useRouter();
  const toast = useAppToast();
  const { mode, setMode } = useColorMode();
  const confirmDialog = useImperativeAlertDialog();
  const pwdFormId = useId();

  const [changePwdOpen, setChangePwdOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submittingPwd, setSubmittingPwd] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const actionInFlight = useRef(false);

  const roleLabel = user.role === "admin" ? "管理员" : "普通用户";
  const canManagePassword = !user.isBuiltIn;
  const accountBusy = isLoggingOut || isResettingPassword;

  async function handleChangePassword(event?: React.FormEvent) {
    event?.preventDefault();
    if (submittingPwd) return;
    if (!currentPassword) {
      toast({ body: "请输入当前密码", type: "error", uniqueID: "pwd-err" });
      return;
    }
    if (newPassword.length < 5 || newPassword.length > 128) {
      toast({
        body: "新密码长度需在 5 到 128 个字符之间",
        type: "error",
        uniqueID: "pwd-err",
      });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({
        body: "两次输入的新密码不一致",
        type: "error",
        uniqueID: "pwd-err",
      });
      return;
    }

    setSubmittingPwd(true);
    try {
      await apiClient.changePassword({
        currentPassword,
        newPassword,
        confirmPassword,
      });
      setChangePwdOpen(false);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast({ body: "密码已更改", uniqueID: "pwd-ok" });
    } catch (error) {
      toast({
        body: error instanceof Error ? error.message : "更改密码失败",
        type: "error",
        uniqueID: "pwd-err",
      });
    } finally {
      setSubmittingPwd(false);
    }
  }

  function openChangePasswordDialog() {
    if (!canManagePassword || accountBusy || actionInFlight.current) return;
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setChangePwdOpen(true);
  }

  function handleResetOwnPassword() {
    if (!canManagePassword || accountBusy || actionInFlight.current) return;
    confirmDialog.show({
      title: "重置密码？",
      description: `你的密码将重置为 ${DEFAULT_USER_PASSWORD}，其他登录会话将失效，当前会话保持登录`,
      actionLabel: "重置密码",
      cancelLabel: "取消",
      onAction: async () => {
        confirmDialog.hide();
        actionInFlight.current = true;
        setIsResettingPassword(true);
        try {
          const result = await apiClient.resetOwnPassword();
          toast({
            body: `密码已重置为 ${result.password}`,
            uniqueID: "reset-self-pwd",
          });
        } catch (error) {
          toast({
            body: error instanceof Error ? error.message : "重置密码失败",
            type: "error",
            uniqueID: "reset-self-pwd",
          });
        } finally {
          actionInFlight.current = false;
          setIsResettingPassword(false);
        }
      },
    });
  }

  async function handleLogout() {
    if (accountBusy || actionInFlight.current) return;
    actionInFlight.current = true;
    setIsLoggingOut(true);
    try {
      await apiClient.logout();
      toast({ body: "已退出登录", uniqueID: "logout" });
      router.replace("/login");
      router.refresh();
    } catch (error) {
      toast({
        body: error instanceof Error ? error.message : "退出登录失败",
        type: "error",
        uniqueID: "logout",
      });
      actionInFlight.current = false;
      setIsLoggingOut(false);
    }
  }

  return (
    <>
      <DropdownMenu
        placement="above"
        alignment="start"
        menuWidth={236}
        renderTrigger={(triggerProps) => (
          <button
            type="button"
            className="account-trigger"
            style={{ textAlign: "start" }}
            aria-label={`账号菜单 ${user.username}`}
            {...triggerProps}
          >
            <HStack as="span" gap={3} vAlign="center" width="100%">
              <Avatar
                src={user.avatarUrl ?? undefined}
                name={user.username}
                size="md"
                tooltip={false}
              />
              <StackItem as="span" size="fill">
                <VStack as="span" gap={0.5} hAlign="stretch">
                  <Text type="label" maxLines={1}>
                    {user.username}
                  </Text>
                  <Text type="supporting" maxLines={1}>
                    {roleLabel}
                  </Text>
                </VStack>
              </StackItem>
              <Icon icon="chevronDown" size="sm" />
            </HStack>
          </button>
        )}
      >
        <div role="presentation" className="account-menu-header">
          <VStack as="span" gap={0.5} padding={2}>
            <Text type="label" maxLines={1}>
              {user.username}
            </Text>
            <Text type="supporting" maxLines={1}>
              {user.username} · {roleLabel}
            </Text>
          </VStack>
        </div>
        <DropdownMenuDivider />
        <DropdownMenuItem
          label="个人信息"
          icon={UserCircleIcon}
          href="/settings/profile"
        />
        {user.role === "admin" && (
          <>
            <DropdownMenuItem
              label="用户权限"
              icon={ShieldCheckIcon}
              href="/settings/permissions"
            />
            <DropdownMenuItem
              label="模型配置"
              icon={RobotIcon}
              href="/settings/models"
            />
          </>
        )}
        <DropdownMenuDivider />
        {canManagePassword && (
          <>
            <DropdownMenuItem
              label="重置密码"
              icon={ArrowPathIcon}
              isDisabled={accountBusy}
              onClick={handleResetOwnPassword}
            />
            <DropdownMenuItem
              label="更改密码"
              icon={KeyIcon}
              isDisabled={accountBusy}
              onClick={openChangePasswordDialog}
            />
          </>
        )}
        <DropdownMenuSubMenu
          label={`主题：${THEME_LABELS[mode]}`}
          icon={SwatchIcon}
        >
          <DropdownMenuRadioGroup
            label="主题"
            value={mode}
            onChange={(next) => {
              if (next === "light" || next === "dark" || next === "system") {
                setMode(next as ThemeMode);
              }
            }}
          >
            <DropdownMenuRadioItem label="亮色" value="light" icon={SunIcon} />
            <DropdownMenuRadioItem label="暗色" value="dark" icon={MoonIcon} />
            <DropdownMenuRadioItem
              label="跟随系统"
              value="system"
              icon={ComputerDesktopIcon}
            />
          </DropdownMenuRadioGroup>
        </DropdownMenuSubMenu>
        <DropdownMenuDivider />
        <DropdownMenuItem
          label={isLoggingOut ? "正在退出…" : "退出登录"}
          icon={ArrowRightStartOnRectangleIcon}
          variant="destructive"
          isDisabled={accountBusy}
          onClick={() => void handleLogout()}
        />
      </DropdownMenu>

      {confirmDialog.element}

      {canManagePassword && (
        <Dialog
          isOpen={changePwdOpen}
          onOpenChange={(open) => {
            if (!submittingPwd) setChangePwdOpen(open);
          }}
          purpose="form"
          width={440}
        >
          <Layout
            header={
              <DialogHeader
                title="更改密码"
                hasDivider
                onOpenChange={(open) => {
                  if (!submittingPwd) setChangePwdOpen(open);
                }}
              />
            }
            content={
              <LayoutContent>
                <form
                  id={pwdFormId}
                  noValidate
                  onSubmit={(event) => void handleChangePassword(event)}
                >
                  <FormLayout>
                    <TextInput
                      label="当前密码"
                      htmlName="currentPassword"
                      type="password"
                      autoComplete="current-password"
                      value={currentPassword}
                      onChange={setCurrentPassword}
                      placeholder="请输入当前密码"
                      isDisabled={submittingPwd}
                    />
                    <TextInput
                      label="新密码"
                      htmlName="newPassword"
                      type="password"
                      autoComplete="new-password"
                      value={newPassword}
                      onChange={setNewPassword}
                      placeholder="5 到 128 位字符"
                      isDisabled={submittingPwd}
                    />
                    <TextInput
                      label="确认新密码"
                      htmlName="confirmPassword"
                      type="password"
                      autoComplete="new-password"
                      value={confirmPassword}
                      onChange={setConfirmPassword}
                      placeholder="请再次输入新密码"
                      isDisabled={submittingPwd}
                    />
                  </FormLayout>
                </form>
              </LayoutContent>
            }
            footer={
              <LayoutFooter>
                <HStack gap={2} hAlign="end">
                  <Button
                    type="button"
                    label="取消"
                    variant="secondary"
                    isDisabled={submittingPwd}
                    onClick={() => setChangePwdOpen(false)}
                  />
                  <Button
                    type="submit"
                    form={pwdFormId}
                    label="确认更改"
                    variant="primary"
                    isLoading={submittingPwd}
                  />
                </HStack>
              </LayoutFooter>
            }
          />
        </Dialog>
      )}
    </>
  );
}
