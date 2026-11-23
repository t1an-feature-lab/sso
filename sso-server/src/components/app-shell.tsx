"use client";

import { useEffect, useRef, useState, useTransition, type ReactNode, type SVGProps } from "react";
import { usePathname } from "next/navigation";
import { AppShell } from "@astryxdesign/core/AppShell";
import { AlertDialog } from "@astryxdesign/core/AlertDialog";
import { Avatar } from "@astryxdesign/core/Avatar";
import { DropdownMenu, DropdownMenuDivider, DropdownMenuItem, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSubMenu } from "@astryxdesign/core/DropdownMenu";
import { Icon } from "@astryxdesign/core/Icon";
import { Layout, LayoutContent } from "@astryxdesign/core/Layout";
import { SideNav, SideNavHeading, SideNavItem, SideNavSection } from "@astryxdesign/core/SideNav";
import { HStack, StackItem, VStack } from "@astryxdesign/core/Stack";
import { Text } from "@astryxdesign/core/Text";
import { useAppToast } from "@/components/app-toast";
import type { PublicUser } from "@/common/types";
import { logoutAction, resetOwnPasswordAction } from "@/server/actions";
import { useColorMode } from "@/app/providers";
import { ProfileDialog } from "./profile";
import { ChangePasswordDialog } from "./change-password-dialog";

const colorModeLabels = { light: "亮色", dark: "暗色", system: "跟随系统" };

function ApplicationsIcon(props: SVGProps<SVGSVGElement>) {
  return <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></svg>;
}

function KeyIcon(props: SVGProps<SVGSVGElement>) {
  return <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="8" cy="8" r="5" /><path d="m11.5 11.5 9 9M16 16l3-3M19 19l2-2" /></svg>;
}

function UsersIcon(props: SVGProps<SVGSVGElement>) {
  return <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="7" r="3.5" /><path d="M2.5 21v-2a6.5 6.5 0 0 1 13 0v2M16 4a3.5 3.5 0 0 1 0 7M21.5 21v-2a6.5 6.5 0 0 0-3.5-5.8" /></svg>;
}

export function ConsoleShell({ user, admin = false, children }: { user: PublicUser; admin?: boolean; children: ReactNode }) {
  const pathname = usePathname();
  const toast = useAppToast();
  const { mode, setMode } = useColorMode();
  const [isLoggingOut, startLogout] = useTransition();
  const [profileOpen, setProfileOpen] = useState(false);
  const [resetPasswordOpen, setResetPasswordOpen] = useState(false);
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const passwordResetInFlight = useRef(false);
  const logoutInFlight = useRef(false);
  const accountBusy = isLoggingOut || isResettingPassword;
  const role = user.role === "admin" ? "管理员" : "普通用户";
  const items = admin
    ? [
        { href: "/admin/users", label: "用户与权限", icon: UsersIcon },
        { href: "/admin/applications", label: "OAuth / OIDC 管理", icon: KeyIcon },
        { href: "/admin/internal-apps", label: "内部子应用", icon: ApplicationsIcon },
      ]
    : [
        { href: "/", label: "OAuth / OIDC 申请", icon: KeyIcon },
      ];

  useEffect(() => {
    if (sessionStorage.getItem("sso:auth-notice") === "login") {
      sessionStorage.removeItem("sso:auth-notice");
      toast({ body: "登录成功", uniqueID: "auth-notice" });
    }
  }, [toast]);

  function logout() {
    if (logoutInFlight.current || passwordResetInFlight.current) return;
    logoutInFlight.current = true;
    startLogout(async () => {
      sessionStorage.setItem("sso:auth-notice", "logout");
      try {
        await logoutAction();
      } catch (error) {
        // Next redirects are handled by the action router.
        if (error instanceof Error && error.message === "NEXT_REDIRECT") throw error;
        sessionStorage.removeItem("sso:auth-notice");
        toast({ body: "退出失败，请重试", type: "error" });
      } finally {
        logoutInFlight.current = false;
      }
    });
  }

  function openPasswordDialog(type: "reset" | "change") {
    if (accountBusy || logoutInFlight.current || passwordResetInFlight.current) return;
    if (type === "reset") setResetPasswordOpen(true);
    else setChangePasswordOpen(true);
  }

  async function resetPassword() {
    if (passwordResetInFlight.current || logoutInFlight.current || accountBusy) return;
    passwordResetInFlight.current = true;
    setIsResettingPassword(true);
    try {
      const result = await resetOwnPasswordAction();
      if (result.error) {
        toast({ body: result.error, type: "error", uniqueID: "account-password-reset" });
        return;
      }
      setResetPasswordOpen(false);
      toast({ body: result.success ?? "密码已重置为 user12345", uniqueID: "account-password-reset" });
    } catch {
      toast({ body: "密码重置失败，请稍后重试", type: "error", uniqueID: "account-password-reset" });
    } finally {
      passwordResetInFlight.current = false;
      setIsResettingPassword(false);
    }
  }

  const accountMenu = (
    <DropdownMenu
      placement="above"
      alignment="start"
      menuWidth={236}
      renderTrigger={(triggerProps) => (
        <button type="button" className="account-trigger" {...triggerProps}>
          <HStack as="span" gap={3} vAlign="center" width="100%">
            <Avatar src={user.avatarUrl || undefined} name={user.username} size="md" tooltip={false} />
            <StackItem as="span" size="fill">
              <VStack as="span" gap={0.5} hAlign="stretch">
                <Text type="label" maxLines={1}>{user.username}</Text>
                <Text type="supporting" maxLines={1}>{user.phone ?? role}</Text>
              </VStack>
            </StackItem>
            <Icon icon="chevronDown" size="sm" />
          </HStack>
        </button>
      )}>
      <DropdownMenuItem label={<VStack as="span" gap={0.5}><Text type="label">{user.username}</Text><Text type="supporting">{user.phone ?? "admin"} · {role}</Text></VStack>} onClick={() => setProfileOpen(true)} />
      <DropdownMenuDivider />
      <DropdownMenuItem label="个人信息" onClick={() => setProfileOpen(true)} />
      <DropdownMenuItem label="重置密码" isDisabled={accountBusy} onClick={() => openPasswordDialog("reset")} />
      <DropdownMenuItem label="更改密码" isDisabled={accountBusy} onClick={() => openPasswordDialog("change")} />
      <DropdownMenuSubMenu label={`主题：${colorModeLabels[mode]}`}>
        <DropdownMenuRadioGroup label="主题" value={mode} onChange={(value) => {
          if (value === "light" || value === "dark" || value === "system") {
            setMode(value);
          }
        }}>
          <DropdownMenuRadioItem value="light" label="亮色" />
          <DropdownMenuRadioItem value="dark" label="暗色" />
          <DropdownMenuRadioItem value="system" label="跟随系统" />
        </DropdownMenuRadioGroup>
      </DropdownMenuSubMenu>
      <DropdownMenuDivider />
      {user.role === "admin" && <DropdownMenuItem label={admin ? "前往前台" : "前往管理后台"} href={admin ? "/" : "/admin"} target="_blank" endContent={<Icon icon="externalLink" size="sm" color="secondary" />} />}
      <DropdownMenuItem label={isLoggingOut ? "正在退出…" : "退出登录"} variant="destructive" isDisabled={accountBusy} onClick={logout} />
    </DropdownMenu>
  );

  return (
    <>
      <AppShell
        variant="section"
        height="fill"
        sideNav={
          <SideNav
            aria-label={`Auth Center ${admin ? "Admin" : "Console"}`}
            header={<SideNavHeading heading={`Auth Center ${admin ? "Admin" : "Console"}`} />}
            footer={accountMenu}>
            <SideNavSection title={admin ? "管理导航" : "应用导航"} isHeaderHidden>
              {items.map((item) => <SideNavItem key={item.href} href={item.href} label={item.label} icon={item.icon} isSelected={item.href === "/" ? pathname === "/" || pathname.startsWith("/applications/") : pathname === item.href || pathname.startsWith(`${item.href}/`)} />)}
            </SideNavSection>
          </SideNav>
        }>
        <Layout height="auto" contentWidth={1440}>
          <LayoutContent isScrollable={false}>
            <VStack gap={4}>{children}</VStack>
          </LayoutContent>
        </Layout>
      </AppShell>
      {profileOpen && <ProfileDialog user={user} isOpen onOpenChange={setProfileOpen} />}
      {changePasswordOpen && <ChangePasswordDialog isOpen onOpenChange={setChangePasswordOpen} />}
      <AlertDialog
        isOpen={resetPasswordOpen}
        onOpenChange={(open) => { if (!passwordResetInFlight.current) setResetPasswordOpen(open); }}
        title="重置密码？"
        description="你的密码将重置为 user12345，其他登录会话将失效，当前会话保持登录"
        actionLabel="重置密码"
        cancelLabel="取消"
        onAction={resetPassword}
        isActionLoading={isResettingPassword}
      />
    </>
  );
}
