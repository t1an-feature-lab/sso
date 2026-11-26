"use client";

import {
  CopyIcon,
  GripVerticalIcon,
  KanbanIcon,
  LayoutGridIcon,
  ListIcon,
  PanelLeftIcon,
  PencilIcon,
  PlusIcon,
  SearchIcon,
  Table2Icon,
  Trash2Icon,
  XIcon,
} from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm-dialog";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { bitableApi } from "@/lib/bitable/api-client";
import { BASE_ICON_COLORS } from "@/lib/bitable/field-registry";
import { queryRecords } from "@/lib/bitable/query-engine";
import type {
  BaseSchema,
  FieldConfig,
  FieldSchema,
  FieldType,
  RecordData,
  TableDetailPayload,
  TableSummary,
  ViewConfig,
  ViewSchema,
  ViewType,
} from "@/lib/bitable/types";
import { cn, reorderList } from "@/lib/utils";
import { FieldDialog } from "./field-dialog";
import { GalleryView } from "./gallery-view";
import { GridView } from "./grid-view";
import { KanbanView } from "./kanban-view";
import { RecordDrawer } from "./record-drawer";
import { BitableToolbar } from "./toolbar";

function ViewTypeIcon({ type }: { type: ViewType }) {
  switch (type) {
    case "grid":
      return <Table2Icon className="size-4" aria-hidden="true" />;
    case "kanban":
      return <KanbanIcon className="size-4" aria-hidden="true" />;
    case "gallery":
      return <LayoutGridIcon className="size-4" aria-hidden="true" />;
  }
}

const VIEW_TYPE_LABELS: Record<ViewType, string> = {
  grid: "表格视图 (Grid)",
  kanban: "看板视图 (Kanban)",
  gallery: "画廊视图 (Gallery)",
};

export function TableWorkspace({
  initialData,
}: {
  initialData: TableDetailPayload;
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [bases, setBases] = useState<BaseSchema[]>(initialData.bases);
  const [tables, setTables] = useState<TableSummary[]>(initialData.tables);
  const [currentTable, setCurrentTable] = useState<TableSummary>(
    initialData.table
  );
  const [fields, setFields] = useState<FieldSchema[]>(initialData.fields);
  const [views, setViews] = useState<ViewSchema[]>(initialData.views);
  const [records, setRecords] = useState<RecordData[]>(initialData.records);
  const cellUpdateSeqRef = useRef<Map<string, number>>(new Map());
  const [totalRecords, setTotalRecords] = useState<number>(
    initialData.totalRecords
  );
  const [hasMoreRecords, setHasMoreRecords] = useState<boolean>(
    initialData.hasMoreRecords
  );
  const [nextRecordOffset, setNextRecordOffset] = useState<number>(
    initialData.nextRecordOffset
  );
  const [loadingMoreRecords, setLoadingMoreRecords] = useState(false);
  const loadingMoreRef = useRef(false);
  const [relationTargets, setRelationTargets] = useState(
    initialData.relationTargets
  );
  const [activeViewId, setActiveViewId] = useState<string>(
    initialData.views[0]?.id ?? ""
  );
  const [viewMenuOpen, setViewMenuOpen] = useState(false);
  const [renamingView, setRenamingView] = useState<ViewSchema | null>(null);
  const [viewNameDraft, setViewNameDraft] = useState("");
  const [viewRenameSubmitting, setViewRenameSubmitting] = useState(false);
  const [viewSearch, setViewSearch] = useState("");
  const [draggingViewId, setDraggingViewId] = useState<string | null>(null);
  const [dropViewTarget, setDropViewTarget] = useState<{
    id: string;
    position: "before" | "after";
  } | null>(null);
  const [search, setSearch] = useState("");
  const [selectedRecordIds, setSelectedRecordIds] = useState<string[]>([]);
  const [drawerRecordId, setDrawerRecordId] = useState<string | null>(null);
  const [linkedRecord, setLinkedRecord] = useState<RecordData | null>(null);
  const linkedAttemptRef = useRef<string | null>(null);
  const appliedTableIdRef = useRef(initialData.table.id);
  const params = useParams<{ tableId?: string }>();
  const activeTableId =
    typeof params.tableId === "string" ? params.tableId : currentTable.id;

  const [fieldDialogOpen, setFieldDialogOpen] = useState(false);
  const [editingField, setEditingField] = useState<FieldSchema | null>(null);

  const [tableDialogOpen, setTableDialogOpen] = useState(false);
  const [editingTable, setEditingTable] = useState<TableSummary | null>(null);
  const [tableNameDraft, setTableNameDraft] = useState("");
  const [tableSubmitting, setTableSubmitting] = useState(false);

  const [baseDialogOpen, setBaseDialogOpen] = useState(false);
  const [baseNameDraft, setBaseNameDraft] = useState("");
  const [baseDescDraft, setBaseDescDraft] = useState("");
  const [baseColorDraft, setBaseColorDraft] = useState(BASE_ICON_COLORS[0]);
  const [baseSubmitting, setBaseSubmitting] = useState(false);

  const [newViewOpen, setNewViewOpen] = useState(false);
  const [newViewName, setNewViewName] = useState("");
  const [newViewType, setNewViewType] = useState<ViewType>("grid");

  useLayoutEffect(() => {
    if (appliedTableIdRef.current === initialData.table.id) return;
    appliedTableIdRef.current = initialData.table.id;
    setBases(initialData.bases);
    setTables(initialData.tables);
    setCurrentTable(initialData.table);
    setFields(initialData.fields);
    setViews(initialData.views);
    setRecords(initialData.records);
    setTotalRecords(initialData.totalRecords);
    setHasMoreRecords(initialData.hasMoreRecords);
    setNextRecordOffset(initialData.nextRecordOffset);
    setRelationTargets(initialData.relationTargets);
    setActiveViewId(initialData.views[0]?.id ?? "");
    setSearch("");
    setSelectedRecordIds([]);
    setDrawerRecordId(null);
    setLinkedRecord(null);
    linkedAttemptRef.current = null;
    setViewMenuOpen(false);
    setViewSearch("");
    setDraggingViewId(null);
    setDropViewTarget(null);
    setRenamingView(null);
    setFieldDialogOpen(false);
    setEditingField(null);
    setNewViewOpen(false);
    setNewViewName("");
    setTableDialogOpen(false);
    setEditingTable(null);
    loadingMoreRef.current = false;
    setLoadingMoreRecords(false);
  }, [initialData]);

  const activeView = useMemo(
    () => views.find((v) => v.id === activeViewId) ?? views[0],
    [views, activeViewId]
  );

  const activeViewConfig: ViewConfig = activeView?.config ?? {};

  const filteredRecords = useMemo(
    () =>
      queryRecords({
        records,
        fields,
        filters: activeViewConfig.filters,
        sorts: activeViewConfig.sorts,
        search,
        relationTargets,
      }),
    [
      records,
      fields,
      activeViewConfig.filters,
      activeViewConfig.sorts,
      search,
      relationTargets,
    ]
  );

  const drawerRecord = useMemo(
    () =>
      records.find((r) => r.id === drawerRecordId) ??
      (linkedRecord?.id === drawerRecordId ? linkedRecord : null),
    [records, drawerRecordId, linkedRecord]
  );

  useEffect(() => {
    const recordId = new URLSearchParams(window.location.search).get("record");
    if (!recordId) return;
    if (records.some((record) => record.id === recordId)) {
      setDrawerRecordId(recordId);
      return;
    }
    if (linkedAttemptRef.current === `${currentTable.id}:${recordId}`) return;
    linkedAttemptRef.current = `${currentTable.id}:${recordId}`;
    let cancelled = false;
    bitableApi
      .getRecord(recordId)
      .then(({ record }) => {
        if (cancelled || record.tableId !== currentTable.id) return;
        setLinkedRecord(record);
        setDrawerRecordId(record.id);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [currentTable.id, records]);

  const filteredViews = useMemo(() => {
    const q = viewSearch.trim().toLowerCase();
    if (!q) return views;
    return views.filter((v) => v.name.toLowerCase().includes(q));
  }, [views, viewSearch]);

  const handleLoadMoreRecords = useCallback(async () => {
    if (loadingMoreRef.current || !hasMoreRecords) return;
    loadingMoreRef.current = true;
    setLoadingMoreRecords(true);
    try {
      const page = await bitableApi.listRecords(currentTable.id, {
        limit: 50,
        offset: nextRecordOffset,
      });
      setRecords((prev) => {
        const seen = new Set(prev.map((r) => r.id));
        const merged = [...prev];
        for (const rec of page.records) {
          if (!seen.has(rec.id)) merged.push(rec);
        }
        return merged;
      });
      setTotalRecords(page.total);
      setHasMoreRecords(page.hasMore);
      setNextRecordOffset(page.nextOffset);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "加载更多记录失败");
    } finally {
      loadingMoreRef.current = false;
      setLoadingMoreRecords(false);
    }
  }, [currentTable.id, hasMoreRecords, nextRecordOffset]);

  async function handleReorderViews(nextViews: ViewSchema[]) {
    const previous = views;
    setViews(nextViews);
    try {
      await bitableApi.reorderViews(
        currentTable.id,
        nextViews.map((v) => v.id)
      );
    } catch (error) {
      setViews(previous);
      toast.error(error instanceof Error ? error.message : "视图排序保存失败");
    }
  }

  async function handleReorderTables(nextTables: TableSummary[]) {
    const previous = tables;
    setTables(nextTables);
    try {
      await bitableApi.reorderTables(
        initialData.base.id,
        nextTables.map((t) => t.id)
      );
    } catch (error) {
      setTables(previous);
      toast.error(error instanceof Error ? error.message : "数据表排序保存失败");
    }
  }

  async function handleReorderRecords(
    sourceId: string,
    targetId: string,
    position: "before" | "after"
  ) {
    if ((activeViewConfig.sorts ?? []).length > 0) {
      toast.error("当前视图有排序，请先清除排序再拖拽");
      return;
    }
    const nextVisible = reorderList(
      filteredRecords,
      sourceId,
      targetId,
      position
    );
    if (!nextVisible) return;

    const visibleIds = new Set(filteredRecords.map((record) => record.id));
    const sorted = [...records].sort(
      (a, b) => a.sortOrder - b.sortOrder || a.createdAt.localeCompare(b.createdAt)
    );
    let visibleIndex = 0;
    const nextOrder = sorted.map((record) =>
      visibleIds.has(record.id) ? nextVisible[visibleIndex++] : record
    );
    const sortOrders = sorted.map((record) => record.sortOrder);
    const updated = nextOrder.map((record, index) => ({
      ...record,
      sortOrder: sortOrders[index] ?? index,
    }));
    const previous = records;
    setRecords(updated);
    try {
      await bitableApi.reorderRecords(
        currentTable.id,
        updated.map((record) => ({
          id: record.id,
          sortOrder: record.sortOrder,
        }))
      );
    } catch (error) {
      setRecords(previous);
      toast.error(error instanceof Error ? error.message : "记录排序保存失败");
    }
  }

  async function refreshRelationTargets() {
    try {
      const fresh = await bitableApi.getTableDetail(currentTable.id);
      setRelationTargets(fresh.relationTargets);
    } catch {
      // Keep existing relation targets if background refresh fails
    }
  }

  async function handleUpdateViewConfig(patch: Partial<ViewConfig>) {
    if (!activeView) return;
    const merged: ViewConfig = { ...activeView.config, ...patch };
    setViews((prev) =>
      prev.map((v) => (v.id === activeView.id ? { ...v, config: merged } : v))
    );
    try {
      await bitableApi.updateView(activeView.id, { config: merged });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "保存视图配置失败");
    }
  }

  async function handleAddRecord(initialValues?: Record<string, unknown>) {
    try {
      const { record } = await bitableApi.createRecord(currentTable.id, {
        values: initialValues,
      });
      setRecords((prev) => [...prev, record]);
      setTotalRecords((prev) => prev + 1);
      setNextRecordOffset((prev) => prev + 1);
      setTables((prev) =>
        prev.map((t) =>
          t.id === currentTable.id
            ? { ...t, recordCount: t.recordCount + 1 }
            : t
        )
      );
      toast.success("已新增记录");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "新增记录失败");
    }
  }

  async function handleInsertRecords(
    anchorId: string,
    position: "before" | "after",
    count: number
  ) {
    try {
      const { records: created } = await bitableApi.insertRecords(
        currentTable.id,
        { anchorRecordId: anchorId, position, count }
      );
      setRecords((prev) => {
        const anchor = prev.find((record) => record.id === anchorId);
        if (!anchor) return [...prev, ...created];
        const start =
          position === "before" ? anchor.sortOrder : anchor.sortOrder + 1;
        const shifted = prev.map((record) =>
          record.sortOrder >= start
            ? { ...record, sortOrder: record.sortOrder + count }
            : record
        );
        return [...shifted, ...created];
      });
      setTotalRecords((prev) => prev + created.length);
      setNextRecordOffset((prev) => prev + created.length);
      setTables((prev) =>
        prev.map((table) =>
          table.id === currentTable.id
            ? { ...table, recordCount: table.recordCount + created.length }
            : table
        )
      );
      toast.success(
        created.length === 1
          ? "已插入 1 条记录"
          : `已插入 ${created.length} 条记录`
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "插入记录失败");
    }
  }

  async function handleCopyRecordLink(recordId: string) {
    const url = new URL(window.location.href);
    url.searchParams.set("record", recordId);
    try {
      await navigator.clipboard.writeText(url.toString());
      toast.success("已复制记录链接");
    } catch {
      toast.error("复制记录链接失败");
    }
  }

  async function handlePlaceKanbanRecord(
    recordId: string,
    fieldId: string,
    optionId: string | null,
    placement: { targetId: string; position: "before" | "after" } | null
  ) {
    const current = records.find((record) => record.id === recordId);
    if (!current) return;
    const currentValue = current.values[fieldId];
    const groupChanged =
      optionId === null
        ? currentValue !== null && currentValue !== undefined && currentValue !== ""
        : String(currentValue ?? "") !== optionId;
    const sorts = activeViewConfig.sorts ?? [];
    if (placement && sorts.length > 0) {
      toast.error("当前视图有排序，请先清除排序再拖拽");
    }

    const withGroup = records.map((record) =>
      record.id === recordId
        ? {
            ...record,
            values: { ...record.values, [fieldId]: optionId },
            updatedAt: new Date().toISOString(),
          }
        : record
    );

    let updated = withGroup;
    let didReorder = false;
    if (placement && sorts.length === 0) {
      const reordered = reorderList(
        filteredRecords,
        recordId,
        placement.targetId,
        placement.position
      );
      if (reordered) {
        didReorder = true;
        const visibleIds = new Set(filteredRecords.map((record) => record.id));
        const sorted = [...withGroup].sort(
          (a, b) =>
            a.sortOrder - b.sortOrder || a.createdAt.localeCompare(b.createdAt)
        );
        let visibleIndex = 0;
        const nextOrder = sorted.map((record) =>
          visibleIds.has(record.id) ? reordered[visibleIndex++] : record
        );
        const sortOrders = sorted.map((record) => record.sortOrder);
        updated = nextOrder.map((record, index) => ({
          ...record,
          sortOrder: sortOrders[index] ?? index,
          values:
            record.id === recordId
              ? { ...record.values, [fieldId]: optionId }
              : record.values,
        }));
      }
    }

    if (!groupChanged && !didReorder) return;
    const previous = records;
    setRecords(updated);
    try {
      if (groupChanged) {
        const { record } = await bitableApi.updateRecord(recordId, {
          [fieldId]: optionId,
        });
        setRecords((prev) =>
          prev.map((item) =>
            item.id === record.id
              ? { ...record, sortOrder: item.sortOrder }
              : item
          )
        );
        setLinkedRecord((prev) => (prev?.id === record.id ? record : prev));
      }
      if (didReorder) {
        await bitableApi.reorderRecords(
          currentTable.id,
          updated.map((record) => ({
            id: record.id,
            sortOrder: record.sortOrder,
          }))
        );
      }
    } catch (error) {
      setRecords(previous);
      toast.error(error instanceof Error ? error.message : "移动记录失败");
    }
  }

  async function handleUpdateCell(
    recordId: string,
    fieldId: string,
    nextValue: unknown
  ) {
    const cellKey = `${recordId}:${fieldId}`;
    const seq = (cellUpdateSeqRef.current.get(cellKey) ?? 0) + 1;
    cellUpdateSeqRef.current.set(cellKey, seq);

    const previous = records;
    setRecords((prev) =>
      prev.map((r) =>
        r.id === recordId
          ? {
              ...r,
              values: { ...r.values, [fieldId]: nextValue },
              updatedAt: new Date().toISOString(),
            }
          : r
      )
    );
    try {
      const { record } = await bitableApi.updateRecord(recordId, {
        [fieldId]: nextValue,
      });
      if (cellUpdateSeqRef.current.get(cellKey) === seq) {
        setRecords((prev) =>
          prev.map((r) =>
            r.id === record.id
              ? {
                  ...record,
                  values: { ...r.values, [fieldId]: record.values[fieldId] },
                }
              : r
          )
        );
        setLinkedRecord((prev) =>
          prev?.id === record.id
            ? {
                ...record,
                values: { ...prev.values, [fieldId]: record.values[fieldId] },
              }
            : prev
        );
      }
    } catch (error) {
      if (cellUpdateSeqRef.current.get(cellKey) === seq) {
        setRecords(previous);
      }
      toast.error(error instanceof Error ? error.message : "更新单元格失败");
    }
  }

  async function handleDeleteRecord(recordId: string) {
    try {
      await bitableApi.deleteRecord(recordId);
      setRecords((prev) => prev.filter((r) => r.id !== recordId));
      setLinkedRecord((prev) => (prev?.id === recordId ? null : prev));
      setDrawerRecordId((prev) => (prev === recordId ? null : prev));
      setTotalRecords((prev) => Math.max(0, prev - 1));
      setNextRecordOffset((prev) => Math.max(0, prev - 1));
      setSelectedRecordIds((prev) => prev.filter((id) => id !== recordId));
      setTables((prev) =>
        prev.map((t) =>
          t.id === currentTable.id
            ? { ...t, recordCount: Math.max(0, t.recordCount - 1) }
            : t
        )
      );
      toast.success("记录已删除");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "删除记录失败");
    }
  }

  async function handleBulkDelete() {
    if (selectedRecordIds.length === 0) return;
    const yes = await confirm({
      title: `删除选中的 ${selectedRecordIds.length} 条记录？`,
      description: "删除后将同步移除关联关系且不可恢复",
      confirmLabel: "删除",
      cancelLabel: "取消",
      destructive: true,
    });
    if (!yes) return;

    try {
      const { deletedCount } = await bitableApi.bulkDeleteRecords(
        currentTable.id,
        selectedRecordIds
      );
      const removed = new Set(selectedRecordIds);
      setRecords((prev) => prev.filter((r) => !removed.has(r.id)));
      setTotalRecords((prev) => Math.max(0, prev - deletedCount));
      setNextRecordOffset((prev) => Math.max(0, prev - deletedCount));
      setSelectedRecordIds([]);
      setTables((prev) =>
        prev.map((t) =>
          t.id === currentTable.id
            ? { ...t, recordCount: Math.max(0, t.recordCount - deletedCount) }
            : t
        )
      );
      toast.success(`已删除 ${deletedCount} 条记录`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "批量删除失败");
    }
  }

  async function handleSaveField(input: {
    id?: string;
    name: string;
    type: FieldType;
    required: boolean;
    config: FieldConfig;
  }) {
    if (input.id) {
      const { field } = await bitableApi.updateField(input.id, {
        name: input.name,
        type: input.type,
        required: input.required,
        config: input.config,
      });
      setFields((prev) => prev.map((f) => (f.id === field.id ? field : f)));
      toast.success("字段已更新");
    } else {
      const { field } = await bitableApi.createField(currentTable.id, {
        name: input.name,
        type: input.type,
        required: input.required,
        config: input.config,
      });
      setFields((prev) => [...prev, field]);
      toast.success("字段已创建");
    }
    if (input.type === "relation") {
      await refreshRelationTargets();
    }
  }

  async function handleDeleteField(field: FieldSchema) {
    if (field.isPrimary) {
      toast.error("主字段不可删除");
      return;
    }
    const yes = await confirm({
      title: `删除字段「${field.name}」？`,
      description: "删除字段后，该列所有历史数据也会一并清除",
      confirmLabel: "删除",
      cancelLabel: "取消",
      destructive: true,
    });
    if (!yes) return;

    try {
      await bitableApi.deleteField(field.id);
      setFields((prev) => prev.filter((f) => f.id !== field.id));
      toast.success("字段已删除");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "删除字段失败");
    }
  }

  async function handleResizeField(fieldId: string, width: number) {
    setFields((prev) =>
      prev.map((f) => (f.id === fieldId ? { ...f, width } : f))
    );
    try {
      await bitableApi.updateField(fieldId, { width });
    } catch {
      // Ignore transient resize persistence errors
    }
  }

  async function handleCreateOrRenameTable(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = tableNameDraft.trim();
    if (!trimmed) {
      toast.error("请输入数据表名称");
      return;
    }

    setTableSubmitting(true);
    try {
      if (editingTable) {
        const { table } = await bitableApi.updateTable(editingTable.id, {
          name: trimmed,
        });
        setTables((prev) => prev.map((t) => (t.id === table.id ? table : t)));
        if (table.id === currentTable.id) setCurrentTable(table);
        setTableDialogOpen(false);
        toast.success("数据表已重命名");
      } else {
        const { table } = await bitableApi.createTable(initialData.base.id, {
          name: trimmed,
        });
        setTables((prev) => [...prev, table]);
        setTableDialogOpen(false);
        toast.success("数据表已创建");
        router.push(`/bases/${initialData.base.id}/tables/${table.id}`);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "操作失败");
    } finally {
      setTableSubmitting(false);
    }
  }

  async function handleDeleteTable(target: TableSummary) {
    const yes = await confirm({
      title: `删除数据表「${target.name}」？`,
      description: "删除后该表下的所有字段、视图和记录都将永久移除",
      confirmLabel: "删除",
      cancelLabel: "取消",
      destructive: true,
    });
    if (!yes) return;

    try {
      await bitableApi.deleteTable(target.id);
      const remaining = tables.filter((t) => t.id !== target.id);
      setTables(remaining);
      toast.success("数据表已删除");
      if (target.id === currentTable.id) {
        if (remaining.length > 0) {
          router.push(`/bases/${initialData.base.id}/tables/${remaining[0].id}`);
        } else {
          router.push(`/bases/${initialData.base.id}`);
        }
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "删除失败");
    }
  }

  async function handleCreateBase(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = baseNameDraft.trim();
    if (!trimmed) {
      toast.error("请输入数据库名称");
      return;
    }
    setBaseSubmitting(true);
    try {
      const res = await bitableApi.createBase({
        name: trimmed,
        description: baseDescDraft.trim(),
        iconColor: baseColorDraft,
      });
      setBases((prev) => [res.base, ...prev]);
      setBaseDialogOpen(false);
      toast.success("数据库已创建");
      router.push(`/bases/${res.base.id}/tables/${res.defaultTableId}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "创建失败");
    } finally {
      setBaseSubmitting(false);
    }
  }

  async function handleCreateView(event: React.FormEvent) {
    event.preventDefault();
    const defaultLabel =
      newViewType === "grid"
        ? "表格视图"
        : newViewType === "kanban"
          ? "看板视图"
          : "画廊视图";
    const name = newViewName.trim() || `${defaultLabel} ${views.length + 1}`;
    const config: ViewConfig =
      newViewType === "kanban"
        ? {
            groupByFieldId: fields.find((f) => f.type === "singleSelect")?.id,
          }
        : { rowHeight: "standard" };
    try {
      const { view } = await bitableApi.createView(currentTable.id, {
        name,
        type: newViewType,
        config,
      });
      setViews((prev) => [...prev, view]);
      setActiveViewId(view.id);
      setNewViewName("");
      setNewViewOpen(false);
      toast.success("视图已创建");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "创建视图失败");
    }
  }

  async function handleRenameView(event: React.FormEvent) {
    event.preventDefault();
    if (!renamingView) return;
    const trimmed = viewNameDraft.trim();
    if (!trimmed) {
      toast.error("请输入视图名称");
      return;
    }
    setViewRenameSubmitting(true);
    try {
      const { view } = await bitableApi.updateView(renamingView.id, {
        name: trimmed,
      });
      setViews((prev) => prev.map((v) => (v.id === view.id ? view : v)));
      setRenamingView(null);
      toast.success("视图已重命名");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "重命名视图失败");
    } finally {
      setViewRenameSubmitting(false);
    }
  }

  async function handleDuplicateView(source: ViewSchema) {
    try {
      const { view } = await bitableApi.createView(currentTable.id, {
        name: `${source.name} 副本`,
        type: source.type,
        config: source.config,
      });
      setViews((prev) => [...prev, view]);
      setActiveViewId(view.id);
      toast.success("视图已复制");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "复制视图失败");
    }
  }

  async function handleDeleteView(view: ViewSchema) {
    if (views.length <= 1) {
      toast.error("至少保留一个视图");
      return;
    }
    const yes = await confirm({
      title: `删除视图「${view.name}」？`,
      description: "仅删除该视图配置，不会影响数据表中的记录",
      confirmLabel: "删除",
      cancelLabel: "取消",
      destructive: true,
    });
    if (!yes) return;

    try {
      await bitableApi.deleteView(view.id);
      const remaining = views.filter((v) => v.id !== view.id);
      setViews(remaining);
      if (activeViewId === view.id && remaining[0]) {
        setActiveViewId(remaining[0].id);
      }
      toast.success("视图已删除");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "删除视图失败");
    }
  }

  return (
    <div className="flex h-dvh w-full overflow-hidden bg-background">
      <AppSidebar
        open={sidebarOpen}
        bases={bases}
        activeBase={initialData.base}
        tables={tables}
        activeTableId={activeTableId}
        onCollapse={() => setSidebarOpen(false)}
        onCreateBase={() => {
          setBaseNameDraft("");
          setBaseDescDraft("");
          setBaseColorDraft(BASE_ICON_COLORS[0]);
          setBaseDialogOpen(true);
        }}
        onCreateTable={() => {
          setEditingTable(null);
          setTableNameDraft("");
          setTableDialogOpen(true);
        }}
        onRenameTable={(table) => {
          setEditingTable(table);
          setTableNameDraft(table.name);
          setTableDialogOpen(true);
        }}
        onDeleteTable={handleDeleteTable}
        onReorderTables={handleReorderTables}
      />

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex h-12 shrink-0 items-center justify-between gap-3 border-b border-border px-4">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <div
              aria-hidden={sidebarOpen}
              inert={sidebarOpen}
              className={cn(
                "shrink-0 overflow-hidden motion-safe:transition-[width,opacity,margin] motion-safe:duration-200 ease-out",
                sidebarOpen ? "-mr-2 w-0 opacity-0" : "-ml-1.5 w-8 opacity-100"
              )}
            >
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="展开侧边栏"
                onClick={() => setSidebarOpen(true)}
                className="shrink-0 text-foreground"
              >
                <PanelLeftIcon className="size-4" aria-hidden="true" />
              </Button>
            </div>

            <div className="flex shrink-0 items-center gap-2 pr-1">
              <Table2Icon
                className="size-4 text-foreground"
                aria-hidden="true"
              />
              <h1 className="text-sm font-normal text-foreground">
                {currentTable.name}
              </h1>
            </div>

            <Popover
              open={viewMenuOpen}
              onOpenChange={(nextOpen) => {
                setViewMenuOpen(nextOpen);
                if (!nextOpen) {
                  setViewSearch("");
                  setDraggingViewId(null);
                  setDropViewTarget(null);
                }
              }}
            >
              <PopoverTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="搜索和排序视图"
                    className="shrink-0 text-foreground"
                  />
                }
              >
                <ListIcon className="size-4" aria-hidden="true" />
              </PopoverTrigger>
              <PopoverContent
                align="start"
                sideOffset={6}
                className="w-64 max-h-(--available-height) gap-0 overflow-hidden p-1.5"
              >
                <div className="relative flex shrink-0 items-center px-1.5 py-1">
                  <SearchIcon
                    className="pointer-events-none size-4 shrink-0 text-foreground/75"
                    aria-hidden="true"
                  />
                  <Input
                    value={viewSearch}
                    onChange={(e) => setViewSearch(e.target.value)}
                    aria-label="搜索视图"
                    placeholder="搜索视图"
                    className="h-7 border-0 bg-transparent px-2 shadow-none focus-visible:ring-0 dark:bg-transparent"
                  />
                  {viewSearch && (
                    <button
                      type="button"
                      aria-label="清空视图搜索"
                      onClick={() => setViewSearch("")}
                      className="text-foreground/70 hover:text-foreground cursor-pointer"
                    >
                      <XIcon className="size-3.5" aria-hidden="true" />
                    </button>
                  )}
                </div>
                <Separator className="my-1" />
                <div className="flex max-h-64 min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto overscroll-contain py-0.5">
                  {filteredViews.length === 0 ? (
                    <p className="py-4 text-center text-xs text-muted-foreground">
                      没有匹配的视图
                    </p>
                  ) : (
                    filteredViews.map((view) => {
                      const isActive = view.id === activeView?.id;
                      const canDrag = !viewSearch.trim() && views.length > 1;
                      const isDragging = draggingViewId === view.id;
                      const isDropBefore =
                        dropViewTarget?.id === view.id &&
                        dropViewTarget.position === "before";
                      const isDropAfter =
                        dropViewTarget?.id === view.id &&
                        dropViewTarget.position === "after";

                      return (
                        <div
                          key={view.id}
                          draggable={canDrag}
                          onDragStart={(e) => {
                            if (!canDrag) return;
                            setDraggingViewId(view.id);
                            e.dataTransfer.effectAllowed = "move";
                            e.dataTransfer.setData("text/plain", view.id);
                          }}
                          onDragOver={(e) => {
                            if (
                              !canDrag ||
                              !draggingViewId ||
                              draggingViewId === view.id
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
                            setDropViewTarget((prev) =>
                              prev?.id === view.id &&
                              prev.position === position
                                ? prev
                                : { id: view.id, position }
                            );
                          }}
                          onDrop={(e) => {
                            if (!canDrag || !draggingViewId || !dropViewTarget)
                              return;
                            e.preventDefault();
                            const next = reorderList(
                              views,
                              draggingViewId,
                              dropViewTarget.id,
                              dropViewTarget.position
                            );
                            setDraggingViewId(null);
                            setDropViewTarget(null);
                            if (next) void handleReorderViews(next);
                          }}
                          onDragEnd={() => {
                            setDraggingViewId(null);
                            setDropViewTarget(null);
                          }}
                          className={cn(
                            "relative flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm font-normal text-foreground transition-colors",
                            isActive ? "bg-accent" : "hover:bg-accent/60",
                            isDragging && "opacity-45",
                            isDropBefore &&
                              "before:absolute before:inset-x-1 before:-top-0.5 before:h-0.5 before:rounded-full before:bg-primary",
                            isDropAfter &&
                              "after:absolute after:inset-x-1 after:-bottom-0.5 after:h-0.5 after:rounded-full after:bg-primary"
                          )}
                        >
                          <button
                            type="button"
                            onClick={() => {
                              setActiveViewId(view.id);
                              setViewMenuOpen(false);
                            }}
                            className="flex min-w-0 flex-1 items-center gap-2 text-left cursor-pointer"
                          >
                            <ViewTypeIcon type={view.type} />
                            <span className="bitable-cell-truncate">
                              {view.name}
                            </span>
                          </button>
                          {canDrag && (
                            <GripVerticalIcon
                              className="size-4 shrink-0 cursor-grab text-muted-foreground active:cursor-grabbing"
                              aria-hidden="true"
                            />
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </PopoverContent>
            </Popover>

            <div className="flex min-w-0 items-center gap-1 overflow-x-auto">
              {views.map((view) => {
                const isActive = view.id === activeView?.id;
                const canDragTab = views.length > 1;
                const isDragging = draggingViewId === view.id;
                const isDropBefore =
                  dropViewTarget?.id === view.id &&
                  dropViewTarget.position === "before";
                const isDropAfter =
                  dropViewTarget?.id === view.id &&
                  dropViewTarget.position === "after";
                return (
                  <ContextMenu key={view.id}>
                  <ContextMenuTrigger
                    render={<button type="button" />}
                    draggable={canDragTab}
                    onDragStart={(e) => {
                      if (!canDragTab) return;
                      setDraggingViewId(view.id);
                      e.dataTransfer.effectAllowed = "move";
                      e.dataTransfer.setData("text/plain", view.id);
                    }}
                    onDragOver={(e) => {
                      if (
                        !canDragTab ||
                        !draggingViewId ||
                        draggingViewId === view.id
                      ) {
                        return;
                      }
                      e.preventDefault();
                      e.dataTransfer.dropEffect = "move";
                      const rect = e.currentTarget.getBoundingClientRect();
                      const position =
                        e.clientX < rect.left + rect.width / 2
                          ? "before"
                          : "after";
                      setDropViewTarget((prev) =>
                        prev?.id === view.id && prev.position === position
                          ? prev
                          : { id: view.id, position }
                      );
                    }}
                    onDrop={(e) => {
                      if (!canDragTab || !draggingViewId || !dropViewTarget)
                        return;
                      e.preventDefault();
                      const next = reorderList(
                        views,
                        draggingViewId,
                        dropViewTarget.id,
                        dropViewTarget.position
                      );
                      setDraggingViewId(null);
                      setDropViewTarget(null);
                      if (next) void handleReorderViews(next);
                    }}
                    onDragEnd={() => {
                      setDraggingViewId(null);
                      setDropViewTarget(null);
                    }}
                    onClick={() => setActiveViewId(view.id)}
                    className={cn(
                      "relative inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md px-2.5 text-sm font-normal text-foreground transition-colors cursor-pointer",
                      isActive ? "bg-muted" : "hover:bg-muted/60",
                      isDragging && "opacity-45",
                      isDropBefore &&
                        "before:absolute before:inset-y-1 before:-left-0.5 before:w-0.5 before:rounded-full before:bg-primary",
                      isDropAfter &&
                        "after:absolute after:inset-y-1 after:-right-0.5 after:w-0.5 after:rounded-full after:bg-primary"
                    )}
                  >
                    <ViewTypeIcon type={view.type} />
                    <span>{view.name}</span>
                  </ContextMenuTrigger>
                  <ContextMenuContent>
                    <ContextMenuItem
                      onClick={() => {
                        setRenamingView(view);
                        setViewNameDraft(view.name);
                      }}
                    >
                      <PencilIcon aria-hidden="true" />
                      重命名视图
                    </ContextMenuItem>
                    <ContextMenuItem onClick={() => handleDuplicateView(view)}>
                      <CopyIcon aria-hidden="true" />
                      复制视图
                    </ContextMenuItem>
                    <ContextMenuSeparator />
                    <ContextMenuItem
                      variant="destructive"
                      disabled={views.length <= 1}
                      onClick={() => handleDeleteView(view)}
                    >
                      <Trash2Icon aria-hidden="true" />
                      删除视图
                    </ContextMenuItem>
                  </ContextMenuContent>
                  </ContextMenu>
                );
              })}

              <Popover open={newViewOpen} onOpenChange={setNewViewOpen}>
                <PopoverTrigger
                  render={
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="新建视图"
                      className="ml-0.5 size-7 shrink-0 text-foreground"
                    />
                  }
                >
                  <PlusIcon className="size-3.5" aria-hidden="true" />
                </PopoverTrigger>
                <PopoverContent align="start" className="w-72">
                  <PopoverTitle>创建新视图</PopoverTitle>
                  <form
                    onSubmit={handleCreateView}
                    className="flex flex-col gap-3"
                  >
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="new-view-name" className="text-[13px] font-normal">
                        视图名称
                      </Label>
                      <Input
                        id="new-view-name"
                        value={newViewName}
                        onChange={(e) => setNewViewName(e.target.value)}
                        placeholder="留空则自动命名"
                        className="h-8 text-[13px] md:text-[13px]"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label className="text-[13px] font-normal">视图类型</Label>
                      <Select
                        value={newViewType}
                        onValueChange={(next) => {
                          if (
                            next === "grid" ||
                            next === "kanban" ||
                            next === "gallery"
                          ) {
                            setNewViewType(next);
                          }
                        }}
                      >
                        <SelectTrigger size="sm" className="w-full">
                          <SelectValue>
                            {() => VIEW_TYPE_LABELS[newViewType]}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="grid">表格视图 (Grid)</SelectItem>
                          <SelectItem value="kanban">看板视图 (Kanban)</SelectItem>
                          <SelectItem value="gallery">
                            画廊视图 (Gallery)
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setNewViewOpen(false)}
                      >
                        取消
                      </Button>
                      <Button type="submit" size="sm">
                        创建
                      </Button>
                    </div>
                  </form>
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </header>

        <BitableToolbar
          fields={fields}
          viewConfig={activeViewConfig}
          search={search}
          selectedCount={selectedRecordIds.length}
          isGridView={!activeView || activeView.type === "grid"}
          onSearchChange={setSearch}
          onAddRecord={() => handleAddRecord()}
          onAddField={() => {
            setEditingField(null);
            setFieldDialogOpen(true);
          }}
          onBulkDelete={handleBulkDelete}
          onUpdateViewConfig={handleUpdateViewConfig}
        />

        {activeView?.type === "kanban" ? (
          <KanbanView
            fields={fields}
            records={filteredRecords}
            groupByFieldId={activeViewConfig.groupByFieldId}
            hiddenFieldIds={activeViewConfig.hiddenFieldIds ?? []}
            relationTargets={relationTargets}
            onOpenRecord={(record) => setDrawerRecordId(record.id)}
            onCreateRecordWithGroup={(fieldId, optionId) =>
              handleAddRecord(optionId ? { [fieldId]: optionId } : undefined)
            }
            onPlaceRecord={handlePlaceKanbanRecord}
          />
        ) : activeView?.type === "gallery" ? (
          <GalleryView
            fields={fields}
            records={filteredRecords}
            hasMore={hasMoreRecords}
            loadingMore={loadingMoreRecords}
            hiddenFieldIds={activeViewConfig.hiddenFieldIds ?? []}
            relationTargets={relationTargets}
            onLoadMore={handleLoadMoreRecords}
            onOpenRecord={(record) => setDrawerRecordId(record.id)}
            onAddRecord={() => handleAddRecord()}
          />
        ) : (
          <GridView
            tableName={currentTable.name}
            fields={fields}
            records={filteredRecords}
            totalRecords={totalRecords}
            hasMore={hasMoreRecords}
            loadingMore={loadingMoreRecords}
            hiddenFieldIds={activeViewConfig.hiddenFieldIds ?? []}
            sorts={activeViewConfig.sorts ?? []}
            rowHeight={activeViewConfig.rowHeight ?? "standard"}
            relationTargets={relationTargets}
            selectedRecordIds={selectedRecordIds}
            onSelectedChange={setSelectedRecordIds}
            onLoadMore={handleLoadMoreRecords}
            onUpdateCell={handleUpdateCell}
            onOpenRecord={(record) => setDrawerRecordId(record.id)}
            onAddRecord={() => handleAddRecord()}
            onAddField={() => {
              setEditingField(null);
              setFieldDialogOpen(true);
            }}
            onEditField={(field) => {
              setEditingField(field);
              setFieldDialogOpen(true);
            }}
            onHideField={(fieldId) => {
              const hidden = activeViewConfig.hiddenFieldIds ?? [];
              if (!hidden.includes(fieldId)) {
                handleUpdateViewConfig({
                  hiddenFieldIds: [...hidden, fieldId],
                });
              }
            }}
            onDeleteField={handleDeleteField}
            onResizeField={handleResizeField}
            onReorderRecords={handleReorderRecords}
            onInsertRecords={handleInsertRecords}
            onCopyRecordLink={handleCopyRecordLink}
            onDeleteRecord={handleDeleteRecord}
            onSortField={(fieldId, direction) => {
              const existing = (activeViewConfig.sorts ?? []).filter(
                (s) => s.fieldId !== fieldId
              );
              handleUpdateViewConfig({
                sorts: [{ fieldId, direction }, ...existing],
              });
            }}
          />
        )}
      </div>

      <FieldDialog
        open={fieldDialogOpen}
        onOpenChange={setFieldDialogOpen}
        editingField={editingField}
        tables={tables}
        currentTableId={currentTable.id}
        onSave={handleSaveField}
      />

      <RecordDrawer
        record={drawerRecord}
        fields={fields}
        relationTargets={relationTargets}
        onClose={() => setDrawerRecordId(null)}
        onUpdateCell={handleUpdateCell}
        onDeleteRecord={handleDeleteRecord}
      />

      <Dialog
        open={renamingView !== null}
        onOpenChange={(open) => {
          if (!open) setRenamingView(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>重命名视图</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleRenameView} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="view-name-input">视图名称</Label>
              <Input
                id="view-name-input"
                value={viewNameDraft}
                onChange={(e) => setViewNameDraft(e.target.value)}
                placeholder="请输入视图名称"
                required
              />
            </div>
            <DialogFooter>
              <DialogClose render={<Button variant="outline" />}>
                取消
              </DialogClose>
              <Button type="submit" disabled={viewRenameSubmitting}>
                {viewRenameSubmitting ? "保存中..." : "保存名称"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={tableDialogOpen} onOpenChange={setTableDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingTable ? "重命名数据表" : "新建数据表"}
            </DialogTitle>
          </DialogHeader>
          <form
            onSubmit={handleCreateOrRenameTable}
            className="flex flex-col gap-4"
          >
            <div className="flex flex-col gap-2">
              <Label htmlFor="table-name-input">数据表名称</Label>
              <Input
                id="table-name-input"
                value={tableNameDraft}
                onChange={(e) => setTableNameDraft(e.target.value)}
                placeholder="例如：客户订单表"
                required
              />
            </div>
            <DialogFooter>
              <DialogClose render={<Button variant="outline" />}>
                取消
              </DialogClose>
              <Button type="submit" disabled={tableSubmitting}>
                {tableSubmitting
                  ? "保存中..."
                  : editingTable
                    ? "保存名称"
                    : "创建数据表"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={baseDialogOpen} onOpenChange={setBaseDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新建数据库</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateBase} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="sidebar-base-name">名称</Label>
              <Input
                id="sidebar-base-name"
                value={baseNameDraft}
                onChange={(e) => setBaseNameDraft(e.target.value)}
                placeholder="例如：客户管理库"
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="sidebar-base-desc">描述</Label>
              <Textarea
                id="sidebar-base-desc"
                value={baseDescDraft}
                onChange={(e) => setBaseDescDraft(e.target.value)}
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
                    aria-pressed={baseColorDraft === color}
                    onClick={() => setBaseColorDraft(color)}
                    className="size-6 rounded-full border-2 transition-transform hover:scale-105 cursor-pointer"
                    style={{
                      backgroundColor: color,
                      borderColor:
                        baseColorDraft === color
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
              <Button type="submit" disabled={baseSubmitting}>
                {baseSubmitting ? "创建中..." : "创建数据库"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
