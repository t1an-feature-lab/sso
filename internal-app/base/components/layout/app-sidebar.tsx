"use client";

import {
  ChevronDownIcon,
  ChevronsLeftIcon,
  DatabaseIcon,
  EllipsisIcon,
  GripVerticalIcon,
  PanelLeftIcon,
  PencilIcon,
  PlusIcon,
  Table2Icon,
  Trash2Icon,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useOptionalCurrentUser } from "@/components/auth/current-user-provider";
import { UserAccountMenu } from "@/components/auth/user-account-menu";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import type { BaseSchema, TableSummary } from "@/lib/bitable/types";
import { cn, reorderList } from "@/lib/utils";

interface AppSidebarProps {
  open?: boolean;
  bases: BaseSchema[];
  activeBase: BaseSchema;
  tables: TableSummary[];
  activeTableId?: string;
  onCollapse?: () => void;
  onCreateBase?: () => void;
  onCreateTable?: () => void;
  onRenameTable?: (table: TableSummary) => void;
  onDeleteTable?: (table: TableSummary) => void;
  onReorderTables?: (nextTables: TableSummary[]) => void;
}

export function AppSidebar({
  open = true,
  bases,
  activeBase,
  tables,
  activeTableId,
  onCollapse,
  onCreateBase,
  onCreateTable,
  onRenameTable,
  onDeleteTable,
  onReorderTables,
}: AppSidebarProps) {
  const router = useRouter();
  const currentUser = useOptionalCurrentUser();
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [draggingTableId, setDraggingTableId] = useState<string | null>(null);
  const [dropTableTarget, setDropTableTarget] = useState<{
    id: string;
    position: "before" | "after";
  } | null>(null);

  return (
    <aside
      aria-hidden={!open}
      inert={!open}
      className={cn(
        "shrink-0 overflow-hidden border-r border-border bg-background text-foreground motion-safe:transition-[width,opacity] motion-safe:duration-200 ease-out",
        open ? "w-60 opacity-100" : "w-0 border-r-0 opacity-0"
      )}
    >
      <div className="flex h-full w-60 flex-col">
        <div className="flex h-12 items-center justify-between gap-0.5 px-2">
          <div className="flex min-w-0 flex-1 items-center gap-0.5">
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="返回数据库列表"
              onClick={() => router.push("/")}
              className="size-7 shrink-0 text-foreground"
            >
              <ChevronsLeftIcon className="size-4" aria-hidden="true" />
            </Button>

            <Popover open={switcherOpen} onOpenChange={setSwitcherOpen}>
              <PopoverTrigger
                render={
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 min-w-0 flex-1 justify-start gap-1 px-1.5 text-sm font-normal text-foreground"
                  />
                }
              >
                <DatabaseIcon
                  className="size-4 shrink-0"
                  style={{ color: activeBase.iconColor }}
                  aria-hidden="true"
                />
                <span className="bitable-cell-truncate">
                  {activeBase.name}
                </span>
                <ChevronDownIcon
                  className={cn(
                    "size-3.5 shrink-0 text-foreground/70 motion-safe:transition-transform motion-safe:duration-200 ease-out",
                    switcherOpen && "rotate-180"
                  )}
                  aria-hidden="true"
                />
              </PopoverTrigger>
            <PopoverContent
              align="start"
              sideOffset={6}
              className="w-72 gap-0 p-1.5"
            >
              <div className="flex h-9 items-center justify-between pr-1 pl-2.5">
                <Link
                  href="/"
                  onClick={() => setSwitcherOpen(false)}
                  className="text-sm font-medium text-foreground hover:underline"
                >
                  数据库管理
                </Link>
                {onCreateBase && (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="新建数据库"
                    onClick={() => {
                      setSwitcherOpen(false);
                      onCreateBase();
                    }}
                    className="size-7 text-foreground"
                  >
                    <PlusIcon className="size-4" aria-hidden="true" />
                  </Button>
                )}
              </div>
              <Separator className="my-1.5" />
              <div className="flex max-h-72 flex-col gap-0.5 overflow-y-auto py-0.5">
                {bases.map((base) => {
                  const isCurrent = base.id === activeBase.id;
                  return (
                    <button
                      key={base.id}
                      type="button"
                      onClick={() => {
                        setSwitcherOpen(false);
                        if (!isCurrent) {
                          router.push(`/bases/${base.id}`);
                        }
                      }}
                      className={cn(
                        "flex h-9 w-full items-center gap-2.5 rounded-sm px-2.5 text-left text-sm font-normal text-foreground transition-colors cursor-pointer",
                        isCurrent ? "bg-accent" : "hover:bg-accent/70"
                      )}
                    >
                      <DatabaseIcon
                        className="size-4 shrink-0"
                        style={{ color: base.iconColor }}
                        aria-hidden="true"
                      />
                      <span className="bitable-cell-truncate flex-1">
                        {base.name}
                      </span>
                    </button>
                  );
                })}
              </div>
            </PopoverContent>
          </Popover>
        </div>

        <div className="flex shrink-0 items-center gap-0.5">
          {onCreateTable && (
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="新建数据表"
              onClick={onCreateTable}
              className="size-7 text-foreground"
            >
              <PlusIcon className="size-4" aria-hidden="true" />
            </Button>
          )}
          {onCollapse && (
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="收起侧边栏"
              onClick={onCollapse}
              className="size-7 text-foreground"
            >
              <PanelLeftIcon className="size-4" aria-hidden="true" />
            </Button>
          )}
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-1.5 overflow-y-auto px-3 pt-2 pb-3">
        <div className="px-1 py-1 text-xs font-normal text-foreground">
          数据表
        </div>

        <nav aria-label="数据表列表" className="flex flex-col gap-1">
          {tables.map((table) => {
            const isActiveTable = table.id === activeTableId;
            const isDragging = draggingTableId === table.id;
            const isDropBefore =
              dropTableTarget?.id === table.id &&
              dropTableTarget.position === "before";
            const isDropAfter =
              dropTableTarget?.id === table.id &&
              dropTableTarget.position === "after";
            return (
              <div
                key={table.id}
                draggable={Boolean(onReorderTables && tables.length > 1)}
                onDragStart={(e) => {
                  if (!onReorderTables) return;
                  setDraggingTableId(table.id);
                  e.dataTransfer.effectAllowed = "move";
                  e.dataTransfer.setData("text/plain", table.id);
                }}
                onDragOver={(e) => {
                  if (!onReorderTables || !draggingTableId) return;
                  if (draggingTableId === table.id) return;
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                  const rect = e.currentTarget.getBoundingClientRect();
                  const position =
                    e.clientY < rect.top + rect.height / 2 ? "before" : "after";
                  setDropTableTarget((prev) =>
                    prev?.id === table.id && prev.position === position
                      ? prev
                      : { id: table.id, position }
                  );
                }}
                onDrop={(e) => {
                  if (!onReorderTables || !draggingTableId || !dropTableTarget) {
                    return;
                  }
                  e.preventDefault();
                  const next = reorderList(
                    tables,
                    draggingTableId,
                    dropTableTarget.id,
                    dropTableTarget.position
                  );
                  setDraggingTableId(null);
                  setDropTableTarget(null);
                  if (next) onReorderTables(next);
                }}
                onDragEnd={() => {
                  setDraggingTableId(null);
                  setDropTableTarget(null);
                }}
                className={cn(
                  "group relative flex h-9 items-center justify-between gap-1 rounded-md px-2.5 text-sm font-normal text-foreground transition-colors",
                  isActiveTable ? "bg-accent" : "hover:bg-accent/60",
                  isDragging && "opacity-45",
                  isDropBefore &&
                    "before:absolute before:inset-x-1 before:-top-0.5 before:h-0.5 before:rounded-full before:bg-primary",
                  isDropAfter &&
                    "after:absolute after:inset-x-1 after:-bottom-0.5 after:h-0.5 after:rounded-full after:bg-primary"
                )}
              >
                <Link
                  href={`/bases/${activeBase.id}/tables/${table.id}`}
                  className="flex min-w-0 flex-1 items-center gap-2.5"
                >
                  {onReorderTables && tables.length > 1 ? (
                    <span className="relative size-4 shrink-0">
                      <Table2Icon
                        className="absolute inset-0 size-4 text-foreground group-hover:invisible"
                        aria-hidden="true"
                      />
                      <GripVerticalIcon
                        className="invisible absolute inset-0 size-4 cursor-grab text-muted-foreground group-hover:visible active:cursor-grabbing"
                        aria-hidden="true"
                      />
                    </span>
                  ) : (
                    <Table2Icon
                      className="size-4 shrink-0 text-foreground"
                      aria-hidden="true"
                    />
                  )}
                  <span className="bitable-cell-truncate">{table.name}</span>
                </Link>

                <div className="flex shrink-0 items-center gap-0.5">
                  {onRenameTable && onDeleteTable && (
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`操作数据表 ${table.name}`}
                            className="hidden size-7 shrink-0 text-foreground group-hover:inline-flex data-popup-open:inline-flex"
                          />
                        }
                      >
                        <EllipsisIcon className="size-4" aria-hidden="true" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => onRenameTable(table)}>
                          <PencilIcon aria-hidden="true" />
                          重命名
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          variant="destructive"
                          onClick={() => onDeleteTable(table)}
                        >
                          <Trash2Icon aria-hidden="true" />
                          删除数据表
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              </div>
            );
          })}
        </nav>
      </div>
      {currentUser ? (
        <div className="border-t border-border px-2 py-2">
          <UserAccountMenu user={currentUser} />
        </div>
      ) : null}
      </div>
    </aside>
  );
}
