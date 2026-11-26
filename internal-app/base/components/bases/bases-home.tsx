"use client";

import {
  ChevronRightIcon,
  DatabaseIcon,
  EllipsisIcon,
  ExternalLinkIcon,
  GripVerticalIcon,
  PencilIcon,
  PlusIcon,
  SearchIcon,
  Table2Icon,
  Trash2Icon,
  XIcon,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useWorkspaceMainRef } from "@/components/layout/workspace-shell";
import { BaseRowsSkeleton } from "@/components/skeletons/page-skeletons";
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { bitableApi } from "@/lib/bitable/api-client";
import { BASE_ICON_COLORS } from "@/lib/bitable/field-registry";
import type {
  BasesListPayload,
  BaseWithTables,
  TableSummary,
} from "@/lib/bitable/types";
import { cn, reorderList } from "@/lib/utils";

const BASES_PAGE_SIZE = 20;

function getBaseHref(base: { id: string; tables: { id: string }[] }) {
  const firstTable = base.tables[0];
  return firstTable
    ? `/bases/${base.id}/tables/${firstTable.id}`
    : `/bases/${base.id}`;
}

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

export function BasesHome({
  initialData,
}: {
  initialData: BasesListPayload;
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const mainRef = useWorkspaceMainRef();
  const [bases, setBases] = useState<BaseWithTables[]>(initialData.bases);
  const [totalBases, setTotalBases] = useState<number>(initialData.total);
  const [hasMore, setHasMore] = useState<boolean>(initialData.hasMore);
  const [nextOffset, setNextOffset] = useState<number>(initialData.nextOffset);
  const [loadingMore, setLoadingMore] = useState(false);
  const [searching, setSearching] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});
  const [search, setSearch] = useState("");
  const sentinelRef = useRef<HTMLDivElement>(null);
  const loadingMoreRef = useRef(false);
  const appliedSearchRef = useRef(search);

  const [draggingBaseId, setDraggingBaseId] = useState<string | null>(null);
  const [dropBaseTarget, setDropBaseTarget] = useState<{
    id: string;
    position: "before" | "after";
  } | null>(null);
  const [draggingNestedTable, setDraggingNestedTable] = useState<{
    baseId: string;
    tableId: string;
  } | null>(null);
  const [dropNestedTarget, setDropNestedTarget] = useState<{
    baseId: string;
    tableId: string;
    position: "before" | "after";
  } | null>(null);

  const [baseDialogOpen, setBaseDialogOpen] = useState(false);
  const [editingBase, setEditingBase] = useState<BaseWithTables | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [iconColor, setIconColor] = useState(BASE_ICON_COLORS[0]);
  const [submitting, setSubmitting] = useState(false);

  const [tableDialogBase, setTableDialogBase] = useState<BaseWithTables | null>(
    null
  );
  const [tableName, setTableName] = useState("");
  const [tableDesc, setTableDesc] = useState("");
  const [tableSubmitting, setTableSubmitting] = useState(false);

  useEffect(() => {
    if (appliedSearchRef.current === search) return;
    appliedSearchRef.current = search;

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setSearching(true);
      try {
        const res = await bitableApi.listBases({
          limit: BASES_PAGE_SIZE,
          offset: 0,
          search,
        });
        if (cancelled) return;
        setBases(res.bases);
        setTotalBases(res.total);
        setHasMore(res.hasMore);
        setNextOffset(res.nextOffset);
      } catch (error) {
        if (!cancelled) {
          toast.error(error instanceof Error ? error.message : "加载数据库列表失败");
        }
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 220);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [search]);

  const loadMoreBases = useCallback(async () => {
    if (loadingMoreRef.current || !hasMore || searching) return;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    try {
      const res = await bitableApi.listBases({
        limit: BASES_PAGE_SIZE,
        offset: nextOffset,
        search,
      });
      setBases((prev) => {
        const seen = new Set(prev.map((b) => b.id));
        const merged = [...prev];
        for (const item of res.bases) {
          if (!seen.has(item.id)) merged.push(item);
        }
        return merged;
      });
      setTotalBases(res.total);
      setHasMore(res.hasMore);
      setNextOffset(res.nextOffset);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "加载更多数据库失败");
    } finally {
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }
  }, [hasMore, nextOffset, search, searching]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    const root = mainRef?.current ?? null;
    if (!sentinel || !hasMore || loadingMore || searching) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          void loadMoreBases();
        }
      },
      { root, rootMargin: "160px" }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, loadingMore, searching, loadMoreBases, bases.length, mainRef]);

  async function handleReorderBases(nextBases: BaseWithTables[]) {
    const previous = bases;
    setBases(nextBases);
    try {
      await bitableApi.reorderBases(nextBases.map((b) => b.id));
    } catch (error) {
      setBases(previous);
      toast.error(error instanceof Error ? error.message : "数据库排序保存失败");
    }
  }

  async function handleReorderNestedTables(
    baseId: string,
    nextTables: TableSummary[]
  ) {
    const previous = bases;
    setBases((prev) =>
      prev.map((b) => (b.id === baseId ? { ...b, tables: nextTables } : b))
    );
    try {
      await bitableApi.reorderTables(
        baseId,
        nextTables.map((t) => t.id)
      );
    } catch (error) {
      setBases(previous);
      toast.error(error instanceof Error ? error.message : "数据表排序保存失败");
    }
  }

  function toggleExpand(baseId: string) {
    setExpandedIds((prev) => ({ ...prev, [baseId]: !prev[baseId] }));
  }

  function openCreateDialog() {
    setEditingBase(null);
    setName("");
    setDescription("");
    setIconColor(BASE_ICON_COLORS[0]);
    setBaseDialogOpen(true);
  }

  function openEditDialog(base: BaseWithTables) {
    setEditingBase(base);
    setName(base.name);
    setDescription(base.description);
    setIconColor(base.iconColor);
    setBaseDialogOpen(true);
  }

  async function handleSubmitBase(event: React.FormEvent) {
    event.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      toast.error("请输入数据库名称");
      return;
    }

    setSubmitting(true);
    try {
      if (editingBase) {
        const { base } = await bitableApi.updateBase(editingBase.id, {
          name: trimmedName,
          description: description.trim(),
          iconColor,
        });
        setBases((prev) =>
          prev.map((item) =>
            item.id === base.id ? { ...item, ...base } : item
          )
        );
        setBaseDialogOpen(false);
        toast.success("数据库已更新");
      } else {
        const result = await bitableApi.createBase({
          name: trimmedName,
          description: description.trim(),
          iconColor,
        });
        setBaseDialogOpen(false);
        toast.success("数据库已创建");
        router.push(`/bases/${result.base.id}/tables/${result.defaultTableId}`);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "操作失败");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeleteBase(base: BaseWithTables) {
    const confirmed = await confirm({
      title: `删除数据库「${base.name}」？`,
      description: "删除后该库下的所有数据表、字段与记录都会被永久移除且不可恢复",
      confirmLabel: "删除",
      cancelLabel: "取消",
      destructive: true,
    });
    if (!confirmed) return;

    try {
      await bitableApi.deleteBase(base.id);
      setBases((prev) => prev.filter((item) => item.id !== base.id));
      setTotalBases((prev) => Math.max(0, prev - 1));
      setNextOffset((prev) => Math.max(0, prev - 1));
      toast.success("数据库已删除");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "删除失败");
    }
  }

  async function handleCreateTableInBase(event: React.FormEvent) {
    event.preventDefault();
    if (!tableDialogBase) return;
    const trimmed = tableName.trim();
    if (!trimmed) {
      toast.error("请输入数据表名称");
      return;
    }
    setTableSubmitting(true);
    try {
      const { table } = await bitableApi.createTable(tableDialogBase.id, {
        name: trimmed,
        description: tableDesc.trim(),
      });
      setBases((prev) =>
        prev.map((b) =>
          b.id === tableDialogBase.id
            ? {
                ...b,
                tableCount: b.tableCount + 1,
                tables: [...b.tables, table],
              }
            : b
        )
      );
      setExpandedIds((prev) => ({ ...prev, [tableDialogBase.id]: true }));
      setTableDialogBase(null);
      setTableName("");
      setTableDesc("");
      toast.success("数据表已创建");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "创建失败");
    } finally {
      setTableSubmitting(false);
    }
  }

  async function handleDeleteNestedTable(
    baseId: string,
    table: TableSummary
  ) {
    const yes = await confirm({
      title: `删除数据表「${table.name}」？`,
      description: "删除后该表下的所有字段、视图和记录都将永久移除",
      confirmLabel: "删除",
      cancelLabel: "取消",
      destructive: true,
    });
    if (!yes) return;
    try {
      await bitableApi.deleteTable(table.id);
      setBases((prev) =>
        prev.map((b) =>
          b.id === baseId
            ? {
                ...b,
                tableCount: Math.max(0, b.tableCount - 1),
                tables: b.tables.filter((t) => t.id !== table.id),
              }
            : b
        )
      );
      toast.success("数据表已删除");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "删除失败");
    }
  }

  return (
    <>
      <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-2.5">
              <Button size="sm" onClick={openCreateDialog}>
                <PlusIcon className="size-4" aria-hidden="true" />
                新建数据库
              </Button>

              <div className="relative w-72 max-w-full">
                <SearchIcon
                  className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-foreground/70"
                  aria-hidden="true"
                />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  aria-label="搜索数据库名称或描述"
                  placeholder="搜索数据库名称或描述"
                  className="h-8 pr-8 pl-8.5 text-sm"
                />
                {search && (
                  <button
                    type="button"
                    aria-label="清空搜索"
                    onClick={() => setSearch("")}
                    className="absolute top-1/2 right-2 -translate-y-1/2 text-foreground/70 hover:text-foreground cursor-pointer"
                  >
                    <XIcon className="size-4" aria-hidden="true" />
                  </button>
                )}
              </div>
            </div>

            <div className="overflow-hidden rounded-md border border-border bg-table-body">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="h-11 border-b border-border bg-table-header text-left text-sm font-normal text-foreground">
                      <th className="w-16 pl-3 pr-1 font-normal" aria-label="展开" />
                      <th className="min-w-48 px-3 font-normal">数据库名称</th>
                      <th className="min-w-60 px-3 font-normal">描述</th>
                      <th className="w-48 px-3 font-normal">创建时间</th>
                      <th className="w-48 px-3 font-normal">编辑时间</th>
                      <th className="w-12 px-3 text-right font-normal" aria-label="操作" />
                    </tr>
                  </thead>
                  <tbody>
                    {searching ? (
                      <BaseRowsSkeleton count={4} />
                    ) : bases.length === 0 ? (
                      <tr>
                        <td
                          colSpan={6}
                          className="py-16 text-center text-sm text-muted-foreground"
                        >
                          {search.trim() ? "没有匹配的数据库" : "暂无数据库"}
                        </td>
                      </tr>
                    ) : (
                      bases.map((base, index) => {
                        const expanded = Boolean(expandedIds[base.id]);
                        const isLast = index === bases.length - 1;
                        const canDragBase = !search.trim();
                        const isDraggingBase = draggingBaseId === base.id;
                        const isDropBaseBefore =
                          dropBaseTarget?.id === base.id &&
                          dropBaseTarget.position === "before";
                        const isDropBaseAfter =
                          dropBaseTarget?.id === base.id &&
                          dropBaseTarget.position === "after";
                        return (
                          <Fragment key={base.id}>
                            <tr
                              draggable={canDragBase}
                              onDragStart={(e) => {
                                if (!canDragBase) return;
                                setDraggingBaseId(base.id);
                                e.dataTransfer.effectAllowed = "move";
                                e.dataTransfer.setData("text/plain", base.id);
                              }}
                              onDragOver={(e) => {
                                if (
                                  !canDragBase ||
                                  !draggingBaseId ||
                                  draggingBaseId === base.id
                                ) {
                                  return;
                                }
                                e.preventDefault();
                                e.dataTransfer.dropEffect = "move";
                                const rect =
                                  e.currentTarget.getBoundingClientRect();
                                const position =
                                  e.clientY < rect.top + rect.height / 2
                                    ? "before"
                                    : "after";
                                setDropBaseTarget((prev) =>
                                  prev?.id === base.id &&
                                  prev.position === position
                                    ? prev
                                    : { id: base.id, position }
                                );
                              }}
                              onDrop={(e) => {
                                if (
                                  !canDragBase ||
                                  !draggingBaseId ||
                                  !dropBaseTarget
                                ) {
                                  return;
                                }
                                e.preventDefault();
                                const next = reorderList(
                                  bases,
                                  draggingBaseId,
                                  dropBaseTarget.id,
                                  dropBaseTarget.position
                                );
                                setDraggingBaseId(null);
                                setDropBaseTarget(null);
                                if (next) void handleReorderBases(next);
                              }}
                              onDragEnd={() => {
                                setDraggingBaseId(null);
                                setDropBaseTarget(null);
                              }}
                              className={cn(
                                "h-11 transition-colors hover:bg-muted/35",
                                (expanded || !isLast || loadingMore) &&
                                  "border-b border-border",
                                isDraggingBase && "opacity-45",
                                isDropBaseBefore &&
                                  "shadow-[inset_0_2px_0_0_var(--primary)]",
                                isDropBaseAfter &&
                                  "shadow-[inset_0_-2px_0_0_var(--primary)]"
                              )}
                            >
                              <td className="py-0 pl-3 pr-1">
                                <div className="flex items-center gap-0.5 text-foreground">
                                  <span
                                    title={canDragBase ? "拖拽排序" : undefined}
                                    className={cn(
                                      "inline-flex size-6 items-center justify-center rounded-sm text-muted-foreground",
                                      canDragBase
                                        ? "cursor-grab active:cursor-grabbing"
                                        : "cursor-default"
                                    )}
                                  >
                                    <GripVerticalIcon
                                      className="size-4 shrink-0"
                                      aria-hidden="true"
                                    />
                                  </span>
                                  <button
                                    type="button"
                                    aria-label={
                                      expanded
                                        ? `收起 ${base.name} 的数据表`
                                        : `展开 ${base.name} 的数据表`
                                    }
                                    aria-expanded={expanded}
                                    onClick={() => toggleExpand(base.id)}
                                    className="flex size-7 items-center justify-center rounded-md text-foreground hover:bg-accent cursor-pointer"
                                  >
                                    <ChevronRightIcon
                                      className={cn(
                                        "size-4 motion-safe:transition-transform motion-safe:duration-200 ease-out",
                                        expanded && "rotate-90"
                                      )}
                                      aria-hidden="true"
                                    />
                                  </button>
                                </div>
                              </td>
                              <td className="px-3 py-0">
                                <Link
                                  href={getBaseHref(base)}
                                  className="flex min-w-0 items-center gap-2 font-normal text-foreground hover:underline"
                                >
                                  <DatabaseIcon
                                    className="size-4 shrink-0"
                                    style={{ color: base.iconColor }}
                                    aria-hidden="true"
                                  />
                                  <span className="bitable-cell-truncate">
                                    {base.name}
                                  </span>
                                </Link>
                              </td>
                              <td className="max-w-xs px-3 py-0 text-foreground/80">
                                <span className="bitable-cell-truncate">
                                  {base.description || "-"}
                                </span>
                              </td>
                              <td className="px-3 py-0 tabular-nums text-foreground/80">
                                {formatDateTime(base.createdAt)}
                              </td>
                              <td className="px-3 py-0 tabular-nums text-foreground/80">
                                {formatDateTime(base.updatedAt)}
                              </td>
                              <td className="px-3 py-0 text-right">
                                <DropdownMenu>
                                  <DropdownMenuTrigger
                                    render={
                                      <Button
                                        variant="ghost"
                                        size="icon-sm"
                                        aria-label={`操作 ${base.name}`}
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
                                      onClick={() =>
                                        router.push(getBaseHref(base))
                                      }
                                    >
                                      <ExternalLinkIcon aria-hidden="true" />
                                      进入数据库
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      onClick={() => {
                                        setTableDialogBase(base);
                                        setTableName("");
                                        setTableDesc("");
                                      }}
                                    >
                                      <PlusIcon aria-hidden="true" />
                                      新建数据表
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      onClick={() => openEditDialog(base)}
                                    >
                                      <PencilIcon aria-hidden="true" />
                                      编辑库信息
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      variant="destructive"
                                      onClick={() => handleDeleteBase(base)}
                                    >
                                      <Trash2Icon aria-hidden="true" />
                                      删除数据库
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </td>
                            </tr>

                            <tr
                              aria-hidden={!expanded}
                              onDragOver={(e) => {
                                if (
                                  !canDragBase ||
                                  !draggingBaseId ||
                                  draggingBaseId === base.id
                                ) {
                                  return;
                                }
                                e.preventDefault();
                                e.dataTransfer.dropEffect = "move";
                                setDropBaseTarget((prev) =>
                                  prev?.id === base.id &&
                                  prev.position === "after"
                                    ? prev
                                    : { id: base.id, position: "after" }
                                );
                              }}
                              onDrop={(e) => {
                                if (
                                  !canDragBase ||
                                  !draggingBaseId ||
                                  !dropBaseTarget
                                ) {
                                  return;
                                }
                                e.preventDefault();
                                const next = reorderList(
                                  bases,
                                  draggingBaseId,
                                  dropBaseTarget.id,
                                  dropBaseTarget.position
                                );
                                setDraggingBaseId(null);
                                setDropBaseTarget(null);
                                if (next) void handleReorderBases(next);
                              }}
                              className={cn(
                                "bg-table-body",
                                expanded && !isLast && "border-b border-border"
                              )}
                            >
                              <td colSpan={6} className="p-0">
                                <div
                                  inert={!expanded}
                                  className={cn(
                                    "grid motion-safe:transition-[grid-template-rows,opacity] motion-safe:duration-200 ease-out",
                                    expanded
                                      ? "grid-rows-[1fr] opacity-100"
                                      : "grid-rows-[0fr] opacity-0"
                                  )}
                                >
                                  <div className="overflow-hidden">
                                    <div className="px-8 py-4">
                                      <div className="overflow-hidden rounded-md border border-border bg-table-body">
                                        <table className="w-full border-collapse text-sm">
                                          <thead>
                                            <tr className="h-10 border-b border-border bg-table-header text-left text-sm font-normal text-foreground">
                                              <th
                                                className="w-10 pl-3 pr-1 font-normal"
                                                aria-label="排序"
                                              />
                                              <th className="min-w-44 px-3 font-normal">
                                                数据表名称
                                              </th>
                                              <th className="min-w-52 px-3 font-normal">
                                                描述
                                              </th>
                                              <th className="w-48 px-3 font-normal">
                                                创建时间
                                              </th>
                                              <th className="w-48 px-3 font-normal">
                                                编辑时间
                                              </th>
                                              <th
                                                className="w-12 px-3 text-right font-normal"
                                                aria-label="操作"
                                              />
                                            </tr>
                                          </thead>
                                          <tbody>
                                            {base.tables.length === 0 ? (
                                              <tr>
                                                <td
                                                  colSpan={6}
                                                  className="py-10 text-center text-sm text-muted-foreground"
                                                >
                                                  暂无数据
                                                </td>
                                              </tr>
                                            ) : (
                                              base.tables.map((table) => {
                                                const canDragTable = true;
                                                const isDraggingTable =
                                                  draggingNestedTable?.baseId ===
                                                    base.id &&
                                                  draggingNestedTable.tableId ===
                                                    table.id;
                                                const isDropTableBefore =
                                                  dropNestedTarget?.baseId ===
                                                    base.id &&
                                                  dropNestedTarget.tableId ===
                                                    table.id &&
                                                  dropNestedTarget.position ===
                                                    "before";
                                                const isDropTableAfter =
                                                  dropNestedTarget?.baseId ===
                                                    base.id &&
                                                  dropNestedTarget.tableId ===
                                                    table.id &&
                                                  dropNestedTarget.position ===
                                                    "after";
                                                return (
                                                  <tr
                                                    key={table.id}
                                                    draggable={canDragTable}
                                                    onDragStart={(e) => {
                                                      if (!canDragTable) return;
                                                      e.stopPropagation();
                                                      setDraggingNestedTable({
                                                        baseId: base.id,
                                                        tableId: table.id,
                                                      });
                                                      e.dataTransfer.effectAllowed =
                                                        "move";
                                                      e.dataTransfer.setData(
                                                        "text/plain",
                                                        table.id
                                                      );
                                                    }}
                                                    onDragOver={(e) => {
                                                      if (
                                                        !canDragTable ||
                                                        !draggingNestedTable ||
                                                        draggingNestedTable.baseId !==
                                                          base.id ||
                                                        draggingNestedTable.tableId ===
                                                          table.id
                                                      ) {
                                                        return;
                                                      }
                                                      e.preventDefault();
                                                      e.stopPropagation();
                                                      e.dataTransfer.dropEffect =
                                                        "move";
                                                      const rect =
                                                        e.currentTarget.getBoundingClientRect();
                                                      const position =
                                                        e.clientY <
                                                        rect.top +
                                                          rect.height / 2
                                                          ? "before"
                                                          : "after";
                                                      setDropNestedTarget(
                                                        (prev) =>
                                                          prev?.baseId ===
                                                            base.id &&
                                                          prev.tableId ===
                                                            table.id &&
                                                          prev.position ===
                                                            position
                                                            ? prev
                                                            : {
                                                                baseId: base.id,
                                                                tableId:
                                                                  table.id,
                                                                position,
                                                              }
                                                      );
                                                    }}
                                                    onDrop={(e) => {
                                                      if (
                                                        !canDragTable ||
                                                        !draggingNestedTable ||
                                                        !dropNestedTarget ||
                                                        draggingNestedTable.baseId !==
                                                          base.id ||
                                                        dropNestedTarget.baseId !==
                                                          base.id
                                                      ) {
                                                        return;
                                                      }
                                                      e.preventDefault();
                                                      e.stopPropagation();
                                                      const next = reorderList(
                                                        base.tables,
                                                        draggingNestedTable.tableId,
                                                        dropNestedTarget.tableId,
                                                        dropNestedTarget.position
                                                      );
                                                      setDraggingNestedTable(
                                                        null
                                                      );
                                                      setDropNestedTarget(null);
                                                      if (next) {
                                                        void handleReorderNestedTables(
                                                          base.id,
                                                          next
                                                        );
                                                      }
                                                    }}
                                                    onDragEnd={() => {
                                                      setDraggingNestedTable(
                                                        null
                                                      );
                                                      setDropNestedTarget(null);
                                                    }}
                                                    className={cn(
                                                      "h-10 border-b border-border last:border-b-0 transition-colors hover:bg-muted/35",
                                                      isDraggingTable &&
                                                        "opacity-45",
                                                      isDropTableBefore &&
                                                        "shadow-[inset_0_2px_0_0_var(--primary)]",
                                                      isDropTableAfter &&
                                                        "shadow-[inset_0_-2px_0_0_var(--primary)]"
                                                    )}
                                                  >
                                                    <td className="w-10 py-0 pl-3 pr-1">
                                                      <span
                                                        title="拖拽排序"
                                                        className="inline-flex size-6 cursor-grab items-center justify-center rounded-sm text-muted-foreground active:cursor-grabbing"
                                                      >
                                                        <GripVerticalIcon
                                                          className="size-4 shrink-0"
                                                          aria-hidden="true"
                                                        />
                                                      </span>
                                                    </td>
                                                    <td className="px-3 py-0">
                                                      <Link
                                                        href={`/bases/${base.id}/tables/${table.id}`}
                                                        className="inline-flex max-w-full items-center gap-2 font-normal text-foreground hover:underline"
                                                      >
                                                        <Table2Icon
                                                          className="size-4 shrink-0 text-foreground"
                                                          aria-hidden="true"
                                                        />
                                                        <span className="bitable-cell-truncate">
                                                          {table.name}
                                                        </span>
                                                      </Link>
                                                    </td>
                                                    <td className="max-w-xs px-3 py-0 text-foreground/80">
                                                      <span className="bitable-cell-truncate">
                                                        {table.description ||
                                                          "-"}
                                                      </span>
                                                    </td>
                                                    <td className="px-3 py-0 tabular-nums text-foreground/80">
                                                      {formatDateTime(
                                                        table.createdAt
                                                      )}
                                                    </td>
                                                    <td className="px-3 py-0 tabular-nums text-foreground/80">
                                                      {formatDateTime(
                                                        table.updatedAt
                                                      )}
                                                    </td>
                                                    <td className="px-3 py-0 text-right">
                                                      <DropdownMenu>
                                                        <DropdownMenuTrigger
                                                          render={
                                                            <Button
                                                              variant="ghost"
                                                              size="icon-sm"
                                                              aria-label={`操作数据表 ${table.name}`}
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
                                                            onClick={() =>
                                                              router.push(
                                                                `/bases/${base.id}/tables/${table.id}`
                                                              )
                                                            }
                                                          >
                                                            <ExternalLinkIcon aria-hidden="true" />
                                                            打开数据表
                                                          </DropdownMenuItem>
                                                          <DropdownMenuItem
                                                            variant="destructive"
                                                            onClick={() =>
                                                              handleDeleteNestedTable(
                                                                base.id,
                                                                table
                                                              )
                                                            }
                                                          >
                                                            <Trash2Icon aria-hidden="true" />
                                                            删除数据表
                                                          </DropdownMenuItem>
                                                        </DropdownMenuContent>
                                                      </DropdownMenu>
                                                    </td>
                                                  </tr>
                                                );
                                              })
                                            )}
                                          </tbody>
                                        </table>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          </Fragment>
                        );
                      })
                    )}
                    {loadingMore && <BaseRowsSkeleton count={3} />}
                  </tbody>
                </table>
              </div>
            </div>

            {hasMore ? (
              <div
                ref={sentinelRef}
                className="flex items-center justify-center py-2 text-xs text-muted-foreground"
              >
                {loadingMore ? (
                  <span>正在加载更多数据库</span>
                ) : (
                  <button
                    type="button"
                    onClick={() => void loadMoreBases()}
                    className="text-xs text-foreground hover:underline cursor-pointer"
                  >
                    加载更多（已显示 {bases.length} / {totalBases}）
                  </button>
                )}
              </div>
            ) : (
              totalBases > BASES_PAGE_SIZE && (
                <div className="py-1 text-center text-xs text-muted-foreground">
                  已加载全部 {totalBases} 个数据库
                </div>
              )
            )}
          </div>

      <Dialog open={baseDialogOpen} onOpenChange={setBaseDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingBase ? "编辑数据库" : "新建数据库"}</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmitBase} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="base-name-input">数据库名称</Label>
              <Input
                id="base-name-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="例如：产研协同"
                required
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="base-desc-input">描述</Label>
              <Textarea
                id="base-desc-input"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="简要描述该数据库的业务用途"
                rows={3}
              />
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium">标识颜色</span>
              <div className="flex flex-wrap gap-2">
                {BASE_ICON_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    aria-label={`选择颜色 ${color}`}
                    aria-pressed={iconColor === color}
                    onClick={() => setIconColor(color)}
                    className="size-6 rounded-full border-2 transition-transform hover:scale-105 cursor-pointer"
                    style={{
                      backgroundColor: color,
                      borderColor:
                        iconColor === color
                          ? "var(--foreground)"
                          : "transparent",
                    }}
                  />
                ))}
              </div>
            </div>

            <DialogFooter>
              <DialogClose render={<Button variant="outline" />}>
                取消
              </DialogClose>
              <Button type="submit" disabled={submitting}>
                {submitting ? "保存中..." : editingBase ? "保存修改" : "创建数据库"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(tableDialogBase)}
        onOpenChange={(open) => {
          if (!open) setTableDialogBase(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新建数据表</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={handleCreateTableInBase}
            className="flex flex-col gap-4"
          >
            <div className="flex flex-col gap-2">
              <Label htmlFor="nested-table-name">数据表名称</Label>
              <Input
                id="nested-table-name"
                value={tableName}
                onChange={(e) => setTableName(e.target.value)}
                placeholder="例如：客户信息表"
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="nested-table-desc">描述</Label>
              <Input
                id="nested-table-desc"
                value={tableDesc}
                onChange={(e) => setTableDesc(e.target.value)}
                placeholder="可选描述信息"
              />
            </div>
            <DialogFooter>
              <DialogClose render={<Button variant="outline" />}>
                取消
              </DialogClose>
              <Button type="submit" disabled={tableSubmitting}>
                {tableSubmitting ? "创建中..." : "创建数据表"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
