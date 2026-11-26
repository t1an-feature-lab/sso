"use client";

import {
  DatabaseIcon,
  PanelLeftIcon,
  ShieldCheckIcon,
  TablePropertiesIcon,
  UsersIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  createContext,
  useContext,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { UserAccountMenu } from "@/components/auth/user-account-menu";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import type { PublicUser } from "@/lib/auth/types";
import { cn } from "@/lib/utils";

const WorkspaceMainContext = createContext<RefObject<HTMLElement | null> | null>(
  null
);

export function useWorkspaceMainRef() {
  return useContext(WorkspaceMainContext);
}

function getHeaderMeta(pathname: string): {
  title: string;
  icon: ReactNode;
} {
  if (
    pathname === "/permissions/users" ||
    pathname.startsWith("/permissions/users/")
  ) {
    return {
      title: "用户权限",
      icon: <UsersIcon className="size-4 text-foreground" aria-hidden="true" />,
    };
  }
  if (
    pathname === "/permissions/bitable" ||
    pathname.startsWith("/permissions/bitable/")
  ) {
    return {
      title: "多维表权限",
      icon: (
        <ShieldCheckIcon
          className="size-4 text-foreground"
          aria-hidden="true"
        />
      ),
    };
  }
  return {
    title: "多维表格",
    icon: (
      <TablePropertiesIcon
        className="size-4 text-foreground"
        aria-hidden="true"
      />
    ),
  };
}

interface WorkspaceShellProps {
  user: PublicUser;
  children: ReactNode;
}

export function WorkspaceShell({
  user,
  children,
}: WorkspaceShellProps) {
  const pathname = usePathname();
  const mainRef = useRef<HTMLElement>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const isAdmin = user.role === "admin";

  const isBitableActive = pathname === "/";
  const isUsersPermissionActive =
    pathname === "/permissions/users" ||
    pathname.startsWith("/permissions/users/");
  const isBitablePermissionActive =
    pathname === "/permissions/bitable" ||
    pathname.startsWith("/permissions/bitable/");

  const header = getHeaderMeta(pathname);

  return (
    <div className="flex h-dvh w-full overflow-hidden bg-background">
      <aside
        aria-hidden={!sidebarOpen}
        inert={!sidebarOpen}
        className={cn(
          "shrink-0 overflow-hidden border-r border-sidebar-border bg-sidebar text-sidebar-foreground motion-safe:transition-[width,opacity] motion-safe:duration-200 ease-out",
          sidebarOpen ? "w-60 opacity-100" : "w-0 border-r-0 opacity-0"
        )}
      >
        <div className="flex h-full w-60 flex-col">
          <div className="flex h-12 items-center gap-2.5 px-3">
            <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground">
              <DatabaseIcon className="size-4" aria-hidden="true" />
            </div>
            <div className="flex min-w-0 flex-1 items-center">
              <span className="bitable-cell-truncate text-sm font-medium">
                Base Studio
              </span>
            </div>
          </div>

          <nav
            aria-label="主导航"
            className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 pt-2 pb-3"
          >
            <Link
              href="/"
              className={cn(
                "flex h-9 items-center gap-2.5 rounded-md px-2.5 text-sm transition-colors",
                isBitableActive
                  ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                  : "font-normal text-foreground/85 hover:bg-sidebar-accent/60 hover:text-foreground"
              )}
            >
              <TablePropertiesIcon
                className="size-4 shrink-0"
                aria-hidden="true"
              />
              <span>多维表格</span>
            </Link>

            {isAdmin && (
              <div className="mt-3 flex flex-col gap-1">
                <div className="px-2.5 py-1 text-xs font-medium text-muted-foreground">
                  权限
                </div>
                <Link
                  href="/permissions/users"
                  className={cn(
                    "flex h-9 items-center gap-2.5 rounded-md px-2.5 text-sm transition-colors",
                    isUsersPermissionActive
                      ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                      : "font-normal text-foreground/85 hover:bg-sidebar-accent/60 hover:text-foreground"
                  )}
                >
                  <UsersIcon className="size-4 shrink-0" aria-hidden="true" />
                  <span>用户权限</span>
                </Link>
                <Link
                  href="/permissions/bitable"
                  className={cn(
                    "flex h-9 items-center gap-2.5 rounded-md px-2.5 text-sm transition-colors",
                    isBitablePermissionActive
                      ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                      : "font-normal text-foreground/85 hover:bg-sidebar-accent/60 hover:text-foreground"
                  )}
                >
                  <ShieldCheckIcon
                    className="size-4 shrink-0"
                    aria-hidden="true"
                  />
                  <span>多维表权限</span>
                </Link>
              </div>
            )}
          </nav>

          <div className="border-t border-sidebar-border px-2 py-2">
            <UserAccountMenu user={user} />
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex h-12 shrink-0 items-center border-b border-border px-4">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={sidebarOpen ? "收起侧边栏" : "展开侧边栏"}
            onClick={() => setSidebarOpen((prev) => !prev)}
            className="-ml-1.5 text-foreground"
          >
            <PanelLeftIcon className="size-4" aria-hidden="true" />
          </Button>
          <Separator orientation="vertical" className="ml-0.5 h-4" />
          <div className="ml-2.5 flex items-center gap-2 text-sm font-normal text-foreground">
            {header.icon}
            <span>{header.title}</span>
          </div>
        </header>

        <WorkspaceMainContext.Provider value={mainRef}>
          <main ref={mainRef} className="flex-1 overflow-y-auto p-4">
            {children}
          </main>
        </WorkspaceMainContext.Provider>
      </div>
    </div>
  );
}
