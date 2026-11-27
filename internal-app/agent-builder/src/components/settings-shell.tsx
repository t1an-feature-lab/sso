"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { AppShell } from "@astryxdesign/core/AppShell";
import { Button } from "@astryxdesign/core/Button";
import { Divider } from "@astryxdesign/core/Divider";
import { Icon } from "@astryxdesign/core/Icon";
import {
  SideNav,
  SideNavItem,
  SideNavSection,
} from "@astryxdesign/core/SideNav";
import { HStack } from "@astryxdesign/core/Stack";
import { Text } from "@astryxdesign/core/Text";
import {
  ArrowLeftIcon,
  ShieldCheckIcon,
  UserCircleIcon,
} from "@heroicons/react/24/outline";
import { RobotIcon } from "@/components/robot-icon";
import type { UserRole } from "@/lib/types";

export function SettingsShell({
  userRole,
  children,
}: {
  userRole: UserRole;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const isAdmin = userRole === "admin";

  return (
    <AppShell
      contentPadding={0}
      sideNav={
        <SideNav
          aria-label="设置导航"
          resizable={{ defaultWidth: 260, minWidth: 220, maxWidth: 360 }}
          header={
            <HStack
              gap={2}
              vAlign="center"
              style={{ paddingInline: "var(--spacing-1)" }}
            >
              <Button
                label="返回工作台"
                variant="ghost"
                size="sm"
                icon={<Icon icon={ArrowLeftIcon} size="sm" />}
                isIconOnly
                href="/"
                tooltip="返回工作台"
              />
              <Divider orientation="vertical" style={{ height: 14 }} />
              <Text type="label" weight="semibold" as="h1" maxLines={1}>
                设置
              </Text>
            </HStack>
          }
        >
          <SideNavSection title="设置菜单" isHeaderHidden>
            <SideNavItem
              label="个人信息"
              icon={UserCircleIcon}
              href="/settings/profile"
              isSelected={
                pathname === "/settings" ||
                pathname.startsWith("/settings/profile")
              }
            />
            {isAdmin && (
              <>
                <SideNavItem
                  label="用户权限"
                  icon={ShieldCheckIcon}
                  href="/settings/permissions"
                  isSelected={pathname.startsWith("/settings/permissions")}
                />
                <SideNavItem
                  label="模型配置"
                  icon={RobotIcon}
                  href="/settings/models"
                  isSelected={pathname.startsWith("/settings/models")}
                />
              </>
            )}
          </SideNavSection>
        </SideNav>
      }
    >
      {children}
    </AppShell>
  );
}
