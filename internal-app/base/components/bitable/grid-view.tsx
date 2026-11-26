"use client";

import {
  columnResizingFeature,
  columnSizingFeature,
  columnVisibilityFeature,
  createColumnHelper,
  rowSelectionFeature,
  tableFeatures,
  useTable,
  type ColumnSizingState,
  type RowSelectionState,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  ChevronDownIcon,
  EyeOffIcon,
  GripVerticalIcon,
  Maximize2Icon,
  PencilIcon,
  PlusIcon,
  Trash2Icon,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { formatCellText } from "@/lib/bitable/field-registry";
import type {
  FieldSchema,
  RecordData,
  RelationTargetItem,
  RowHeight,
  SortCondition,
} from "@/lib/bitable/types";
import { cn } from "@/lib/utils";
import { GridCellEditor } from "./cell-editor";
import { FieldTypeIcon } from "./field-icon";
import { FieldHeaderMenu, RecordRowMenu } from "./grid-context-menu";

const features = tableFeatures({
  columnSizingFeature,
  columnResizingFeature,
  columnVisibilityFeature,
  rowSelectionFeature,
});

const columnHelper = createColumnHelper<typeof features, RecordData>();

const ROW_HEIGHT_PX: Record<RowHeight, number> = {
  compact: 36,
  standard: 44,
  tall: 60,
};

const SELECT_COL_WIDTH = 96;
const ADD_FIELD_COL_WIDTH = 120;

function setRecordDragImage(event: {
  clientX: number;
  clientY: number;
  currentTarget: EventTarget & Element;
  dataTransfer: DataTransfer;
}) {
  const rowEl = event.currentTarget.closest("tr");
  const scroll = rowEl?.closest(".bitable-grid-scroll");
  if (!(rowEl instanceof HTMLElement) || !(scroll instanceof HTMLElement)) return;

  const rowRect = rowEl.getBoundingClientRect();
  const scrollRect = scroll.getBoundingClientRect();
  const visibleLeft = Math.max(rowRect.left, scrollRect.left);
  const visibleRight = Math.min(rowRect.right, scrollRect.right);
  const visibleWidth = Math.max(rowRect.height, visibleRight - visibleLeft);

  const frame = document.createElement("div");
  frame.style.position = "fixed";
  frame.style.top = "-10000px";
  frame.style.left = "0";
  frame.style.width = `${visibleWidth}px`;
  frame.style.height = `${rowRect.height}px`;
  frame.style.overflow = "hidden";
  frame.style.pointerEvents = "none";
  frame.style.borderRadius = "8px";
  frame.style.background = "var(--table-body)";
  frame.style.boxShadow = "0 8px 24px rgb(0 0 0 / 16%)";

  const clone = rowEl.cloneNode(true);
  if (!(clone instanceof HTMLElement)) return;
  clone.style.position = "relative";
  clone.style.top = "0";
  clone.style.left = `${rowRect.left - visibleLeft}px`;
  clone.style.transform = "none";
  clone.style.width = `${rowRect.width}px`;
  clone.style.height = `${rowRect.height}px`;
  clone.style.margin = "0";
  clone.style.opacity = "1";
  frame.appendChild(clone);
  document.body.appendChild(frame);

  event.dataTransfer.setDragImage(
    frame,
    event.clientX - visibleLeft,
    event.clientY - rowRect.top
  );
  window.setTimeout(() => frame.remove(), 0);
}

interface GridViewProps {
  tableName: string;
  fields: FieldSchema[];
  records: RecordData[];
  totalRecords: number;
  hasMore: boolean;
  loadingMore: boolean;
  hiddenFieldIds: string[];
  sorts: SortCondition[];
  rowHeight: RowHeight;
  relationTargets: Record<string, RelationTargetItem[]>;
  selectedRecordIds: string[];
  onSelectedChange: (ids: string[]) => void;
  onLoadMore: () => void;
  onUpdateCell: (recordId: string, fieldId: string, value: unknown) => void;
  onOpenRecord: (record: RecordData) => void;
  onAddRecord: () => void;
  onAddField: () => void;
  onEditField: (field: FieldSchema) => void;
  onHideField: (fieldId: string) => void;
  onDeleteField: (field: FieldSchema) => void;
  onResizeField: (fieldId: string, width: number) => void;
  onReorderRecords: (
    sourceId: string,
    targetId: string,
    position: "before" | "after"
  ) => void;
  onInsertRecords: (
    recordId: string,
    position: "before" | "after",
    count: number
  ) => void;
  onCopyRecordLink: (recordId: string) => void;
  onDeleteRecord: (recordId: string) => void;
  onSortField: (fieldId: string, direction: "asc" | "desc") => void;
}

export function GridView({
  tableName,
  fields,
  records,
  totalRecords,
  hasMore,
  loadingMore,
  hiddenFieldIds,
  sorts,
  rowHeight,
  relationTargets,
  selectedRecordIds,
  onSelectedChange,
  onLoadMore,
  onUpdateCell,
  onOpenRecord,
  onAddRecord,
  onAddField,
  onEditField,
  onHideField,
  onDeleteField,
  onResizeField,
  onReorderRecords,
  onInsertRecords,
  onCopyRecordLink,
  onDeleteRecord,
  onSortField,
}: GridViewProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>({});
  const [frozenEdgeShadow, setFrozenEdgeShadow] = useState(false);
  const [draggingRecordId, setDraggingRecordId] = useState<string | null>(null);
  const [dropRecordTarget, setDropRecordTarget] = useState<{
    id: string;
    position: "before" | "after";
  } | null>(null);
  const recordDragRef = useRef({
    canDrag: false,
    sorted: false,
    start: (_id: string) => {},
    end: () => {},
  });
  recordDragRef.current.canDrag = sorts.length === 0 && records.length > 1;
  recordDragRef.current.sorted = sorts.length > 0;
  recordDragRef.current.start = (id: string) => setDraggingRecordId(id);
  recordDragRef.current.end = () => {
    setDraggingRecordId(null);
    setDropRecordTarget(null);
  };
  const rowPx = ROW_HEIGHT_PX[rowHeight];

  const rowSelection = useMemo<RowSelectionState>(() => {
    const map: RowSelectionState = {};
    for (const id of selectedRecordIds) {
      map[id] = true;
    }
    return map;
  }, [selectedRecordIds]);

  const columnVisibility = useMemo<Record<string, boolean>>(() => {
    const vis: Record<string, boolean> = {};
    for (const field of fields) {
      vis[field.id] = field.isPrimary || !hiddenFieldIds.includes(field.id);
    }
    return vis;
  }, [fields, hiddenFieldIds]);

  const sortMap = useMemo(() => {
    const map = new Map<string, "asc" | "desc">();
    for (const sort of sorts) {
      map.set(sort.fieldId, sort.direction);
    }
    return map;
  }, [sorts]);

  const callbacksRef = useRef({
    onAddField,
    onDeleteField,
    onEditField,
    onHideField,
    onOpenRecord,
    onSortField,
    onUpdateCell,
  });
  useEffect(() => {
    callbacksRef.current = {
      onAddField,
      onDeleteField,
      onEditField,
      onHideField,
      onOpenRecord,
      onSortField,
      onUpdateCell,
    };
  });

  const fieldMap = useMemo(
    () => new Map(fields.map((field) => [field.id, field])),
    [fields]
  );

  const primaryFieldId = useMemo(
    () => (fields.find((f) => f.isPrimary) ?? fields[0])?.id,
    [fields]
  );

  const columns = useMemo(() => {
    const selectCol = columnHelper.display({
      id: "__select__",
      size: SELECT_COL_WIDTH,
      minSize: SELECT_COL_WIDTH,
      maxSize: SELECT_COL_WIDTH,
      enableResizing: false,
      header: ({ table }) => {
        const allSelected = table.getIsAllRowsSelected();
        const someSelected = table.getIsSomeRowsSelected();
        return (
          <div className="flex h-full w-full items-center justify-center">
            <Checkbox
              checked={allSelected}
              indeterminate={someSelected && !allSelected}
              onCheckedChange={(next) => {
                table.toggleAllRowsSelected(Boolean(next));
              }}
              aria-label="全选当前视图记录"
            />
          </div>
        );
      },
      cell: ({ row }) => {
        const selected = row.getIsSelected();
        return (
          <div className="relative flex h-full w-full items-center justify-center">
            <span
              className={cn(
                "text-xs tabular-nums text-muted-foreground",
                selected && "invisible",
                "group-hover/row:invisible"
              )}
            >
              {row.index + 1}
            </span>
            <div className="absolute inset-0 flex items-center justify-center gap-2">
              <button
                type="button"
                draggable
                aria-label={`拖拽第 ${row.index + 1} 行`}
                onDragStart={(event) => {
                  if (recordDragRef.current.sorted) {
                    event.preventDefault();
                    toast.error("当前视图有排序，请先清除排序再拖拽");
                    return;
                  }
                  if (!recordDragRef.current.canDrag) {
                    event.preventDefault();
                    return;
                  }
                  event.dataTransfer.effectAllowed = "move";
                  event.dataTransfer.setData("text/plain", row.original.id);
                  setRecordDragImage(event);
                  recordDragRef.current.start(row.original.id);
                }}
                onDragEnd={() => recordDragRef.current.end()}
                className="pointer-events-none flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground opacity-0 cursor-grab transition-colors hover:bg-muted hover:text-foreground group-hover/row:pointer-events-auto group-hover/row:opacity-100 focus-visible:pointer-events-auto focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing"
              >
                <GripVerticalIcon className="size-4" aria-hidden="true" />
              </button>
              <span className="flex size-6 items-center justify-center">
                <Checkbox
                  checked={selected}
                  onCheckedChange={(next) => row.toggleSelected(Boolean(next))}
                  aria-label={`选择第 ${row.index + 1} 行`}
                  className={cn(
                    selected
                      ? "opacity-100"
                      : "opacity-0 group-hover/row:opacity-100"
                  )}
                />
              </span>
              <button
                type="button"
                aria-label={`展开第 ${row.index + 1} 行详情`}
                onClick={() => callbacksRef.current.onOpenRecord(row.original)}
                className="pointer-events-none flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground opacity-0 cursor-pointer transition-colors hover:bg-muted hover:text-foreground group-hover/row:pointer-events-auto group-hover/row:opacity-100 focus-visible:pointer-events-auto focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Maximize2Icon className="size-3.5" aria-hidden="true" />
              </button>
            </div>
          </div>
        );
      },
    });

    const dataCols = fields.map((field) =>
      columnHelper.accessor((row) => row.values[field.id], {
        id: field.id,
        size: field.width,
        minSize: 110,
        maxSize: 640,
        enableResizing: true,
        header: () => {
          const activeSort = sortMap.get(field.id);
          return (
            <div className="flex h-full w-full min-w-0 items-center justify-between gap-1 px-2.5">
              <div className="flex min-w-0 flex-1 items-center gap-1.5">
                <FieldTypeIcon type={field.type} />
                <span className="bitable-cell-truncate text-sm font-normal text-foreground">
                  {field.name}
                </span>
                {field.required && (
                  <span className="shrink-0 text-destructive">*</span>
                )}
                {activeSort === "asc" && (
                  <ArrowUpIcon
                    className="size-4 shrink-0 text-foreground"
                    aria-hidden="true"
                  />
                )}
                {activeSort === "desc" && (
                  <ArrowDownIcon
                    className="size-4 shrink-0 text-foreground"
                    aria-hidden="true"
                  />
                )}
              </div>

              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      aria-label={`列操作 ${field.name}`}
                      className="group/col-menu size-6 shrink-0 text-foreground/60 hover:bg-muted hover:text-foreground aria-expanded:bg-muted dark:hover:bg-muted dark:aria-expanded:bg-muted"
                    />
                  }
                >
                  <ChevronDownIcon
                    className="size-3.5 motion-safe:transition-transform motion-safe:duration-200 ease-out group-data-popup-open/col-menu:rotate-180"
                    aria-hidden="true"
                  />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={() =>
                      callbacksRef.current.onSortField(field.id, "asc")
                    }
                  >
                    <ArrowUpIcon aria-hidden="true" />
                    按此列升序
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() =>
                      callbacksRef.current.onSortField(field.id, "desc")
                    }
                  >
                    <ArrowDownIcon aria-hidden="true" />
                    按此列降序
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => callbacksRef.current.onEditField(field)}
                  >
                    <PencilIcon aria-hidden="true" />
                    编辑字段配置
                  </DropdownMenuItem>
                  {!field.isPrimary && (
                    <DropdownMenuItem
                      onClick={() => callbacksRef.current.onHideField(field.id)}
                    >
                      <EyeOffIcon aria-hidden="true" />
                      隐藏字段
                    </DropdownMenuItem>
                  )}
                  {!field.isPrimary && (
                    <DropdownMenuItem
                      variant="destructive"
                      onClick={() => callbacksRef.current.onDeleteField(field)}
                    >
                      <Trash2Icon aria-hidden="true" />
                      删除字段
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          );
        },
        cell: () => null,
      })
    );

    const addFieldCol = columnHelper.display({
      id: "__add_field__",
      size: ADD_FIELD_COL_WIDTH,
      minSize: ADD_FIELD_COL_WIDTH,
      maxSize: ADD_FIELD_COL_WIDTH,
      enableResizing: false,
      header: () => (
        <Button
          variant="ghost"
          aria-label="新增字段"
          onClick={() => callbacksRef.current.onAddField()}
          className="h-full w-full rounded-none text-foreground"
        >
          <PlusIcon className="size-4" aria-hidden="true" />
        </Button>
      ),
      cell: () => null,
    });

    return columnHelper.columns([selectCol, ...dataCols, addFieldCol]);
  }, [fields, sortMap]);

  const table = useTable({
    features,
    data: records,
    columns,
    getRowId: (row) => row.id,
    columnResizeMode: "onChange",
    enableRowSelection: true,
    state: {
      columnVisibility,
      rowSelection,
      columnSizing,
    },
    onColumnSizingChange: setColumnSizing,
    onRowSelectionChange: (updater) => {
      const next =
        typeof updater === "function" ? updater(rowSelection) : updater;
      const ids = Object.keys(next).filter((id) => next[id]);
      onSelectedChange(ids);
    },
  });

  const rows = table.getRowModel().rows;

  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => rowPx,
    getItemKey: (index) => `${rows[index].id}:${rowHeight}`,
    overscan: 8,
  });

  const totalWidth = table.getTotalSize();
  const frozenEdge =
    SELECT_COL_WIDTH +
    (primaryFieldId ? (table.getColumn(primaryFieldId)?.getSize() ?? 0) : 0);
  const visibleColumns = table.getVisibleLeafColumns();

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !hasMore || loadingMore) return;
    if (el.scrollHeight - el.clientHeight < 120) {
      onLoadMore();
    }
  }, [hasMore, loadingMore, onLoadMore, rows.length]);

  function handleGridScroll(event: React.UIEvent<HTMLDivElement>) {
    const el = event.currentTarget;
    const scrolled = el.scrollLeft > 0;
    setFrozenEdgeShadow((prev) => (prev === scrolled ? prev : scrolled));
    if (!hasMore || loadingMore) return;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 240) {
      onLoadMore();
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-background">
      <div className="relative min-h-0 flex-1">
      <div
        ref={scrollRef}
        tabIndex={0}
        role="region"
        aria-label={`${tableName} 数据表格`}
        onScroll={handleGridScroll}
        className="bitable-grid-scroll h-full bg-table-body"
      >
        <table
          className="bitable-grid-table grid"
          style={{ width: totalWidth, minWidth: "100%" }}
        >
          <thead className="sticky top-0 z-20 grid bg-table-header">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr
                key={headerGroup.id}
                className="flex border-b border-border"
                style={{ height: 40 }}
              >
                {headerGroup.headers.map((header) => {
                  const isSelectCol = header.id === "__select__";
                  const isPrimaryCol = header.id === primaryFieldId;
                  const isStickyLeft = isSelectCol || isPrimaryCol;
                  const field = fields.find((item) => item.id === header.id);
                  const cell = (
                    <th
                      key={header.id}
                      scope="col"
                      style={{
                        width: header.getSize(),
                        position: isStickyLeft ? "sticky" : "relative",
                        insetInlineStart: isSelectCol
                          ? 0
                          : isPrimaryCol
                            ? SELECT_COL_WIDTH
                            : undefined,
                        zIndex: isStickyLeft ? 30 : 1,
                      }}
                      className="flex shrink-0 items-center border-r border-border bg-table-header p-0 text-left font-normal"
                    >
                      {header.isPlaceholder ? null : (
                        <table.FlexRender header={header} />
                      )}
                      {header.column.getCanResize() && (
                        <div
                          role="separator"
                          aria-orientation="vertical"
                          aria-label={`调整 ${header.id} 列宽`}
                          onMouseDown={(e) => {
                            header.getResizeHandler()(e);
                            const handleUp = () => {
                              window.removeEventListener("mouseup", handleUp);
                              onResizeField(header.id, header.column.getSize());
                            };
                            window.addEventListener("mouseup", handleUp);
                          }}
                          onTouchStart={header.getResizeHandler()}
                          className="absolute top-0 right-0 h-full w-1.5 cursor-col-resize select-none touch-none hover:bg-ring"
                        />
                      )}
                    </th>
                  );
                  if (!field) return cell;
                  return (
                    <FieldHeaderMenu
                      key={header.id}
                      field={field}
                      trigger={cell}
                      onSortField={onSortField}
                      onEditField={onEditField}
                      onHideField={onHideField}
                      onDeleteField={onDeleteField}
                    />
                  );
                })}
              </tr>
            ))}
          </thead>

          <tbody
            className="relative grid"
            style={{ height: rowVirtualizer.getTotalSize() }}
          >
            {rowVirtualizer.getVirtualItems().map((virtualRow) => {
              const row = rows[virtualRow.index];
              const isSelected = row.getIsSelected();
              const isDragging = draggingRecordId === row.original.id;
              const isDropBefore =
                dropRecordTarget?.id === row.original.id &&
                dropRecordTarget.position === "before";
              const isDropAfter =
                dropRecordTarget?.id === row.original.id &&
                dropRecordTarget.position === "after";
              const primaryField =
                fields.find((field) => field.isPrimary) ?? fields[0];
              const recordTitle =
                (primaryField &&
                  formatCellText(
                    primaryField,
                    row.original.values[primaryField.id],
                    relationTargets
                  )) ||
                "未命名记录";
              return (
                <RecordRowMenu
                  key={row.id}
                  recordTitle={recordTitle}
                  onInsert={(position, count) =>
                    onInsertRecords(row.original.id, position, count)
                  }
                  onCopyLink={() => onCopyRecordLink(row.original.id)}
                  onDelete={() => onDeleteRecord(row.original.id)}
                  trigger={
                <tr
                  data-index={virtualRow.index}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    height: rowPx,
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                  onDragOver={(event) => {
                    if (!draggingRecordId || draggingRecordId === row.original.id) {
                      return;
                    }
                    event.preventDefault();
                    const rect = event.currentTarget.getBoundingClientRect();
                    const position =
                      event.clientY < rect.top + rect.height / 2
                        ? "before"
                        : "after";
                    setDropRecordTarget((prev) =>
                      prev?.id === row.original.id && prev.position === position
                        ? prev
                        : { id: row.original.id, position }
                    );
                  }}
                  onDrop={(event) => {
                    if (!draggingRecordId || draggingRecordId === row.original.id) {
                      return;
                    }
                    event.preventDefault();
                    const rect = event.currentTarget.getBoundingClientRect();
                    const position =
                      event.clientY < rect.top + rect.height / 2
                        ? "before"
                        : "after";
                    onReorderRecords(draggingRecordId, row.original.id, position);
                    setDraggingRecordId(null);
                    setDropRecordTarget(null);
                  }}
                  className={cn(
                    "group/row flex border-b border-border transition-colors",
                    isSelected
                      ? "bg-muted/70"
                      : "bg-table-body hover:bg-muted/30",
                    isDragging && "opacity-45",
                    isDropBefore &&
                      "before:pointer-events-none before:absolute before:inset-x-3 before:-top-0.5 before:z-30 before:h-0.5 before:rounded-full before:bg-primary",
                    isDropAfter &&
                      "after:pointer-events-none after:absolute after:inset-x-3 after:-bottom-0.5 after:z-30 after:h-0.5 after:rounded-full after:bg-primary"
                  )}
                >
                  {row.getVisibleCells().map((cell) => {
                    const colId = cell.column.id;
                    const isSelectCol = colId === "__select__";
                    const isPrimaryCol = colId === primaryFieldId;
                    const isStickyLeft = isSelectCol || isPrimaryCol;
                    const field = fieldMap.get(colId);
                    return (
                      <td
                        key={cell.id}
                        style={{
                          width: cell.column.getSize(),
                          position: isStickyLeft ? "sticky" : "relative",
                          insetInlineStart: isSelectCol
                            ? 0
                            : isPrimaryCol
                              ? SELECT_COL_WIDTH
                              : undefined,
                          zIndex: isStickyLeft ? 10 : 1,
                        }}
                        className={cn(
                          "flex shrink-0 items-center overflow-hidden border-r border-border p-0",
                          isStickyLeft &&
                            (isSelected ? "bg-muted" : "bg-table-body")
                        )}
                      >
                        {field ? (
                          <GridCellEditor
                            field={field}
                            value={row.original.values[field.id]}
                            relationTargets={relationTargets}
                            onChange={(nextValue) =>
                              onUpdateCell(row.original.id, field.id, nextValue)
                            }
                          />
                        ) : (
                          <table.FlexRender cell={cell} />
                        )}
                      </td>
                    );
                  })}
                </tr>
                  }
                />
              );
            })}
          </tbody>
        </table>

        {rows.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-2 border-b border-border py-16 text-center">
            <p className="text-xs font-medium text-muted-foreground">
              暂无符合条件的记录
            </p>
          </div>
        )}

        {loadingMore && (
          <div
            aria-busy="true"
            aria-label="正在加载更多记录"
            style={{ width: totalWidth, minWidth: "100%" }}
          >
            {Array.from({ length: 3 }).map((_, rowIdx) => (
              <div
                key={`grid-loading-${rowIdx}`}
                className="flex border-b border-border bg-table-body"
                style={{ height: rowPx }}
              >
                {visibleColumns.map((col) => (
                  <div
                    key={`${rowIdx}-${col.id}`}
                    style={{ width: col.getSize() }}
                    className="flex shrink-0 items-center border-r border-border px-2.5"
                  >
                    {col.id !== "__add_field__" && (
                      <Skeleton
                        className={cn(
                          "h-4",
                          col.id === "__select__" ? "w-5" : "w-3/4 max-w-40"
                        )}
                      />
                    )}
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}

        <div
          className="flex h-9 items-center border-b border-border bg-table-body"
          style={{ width: totalWidth, minWidth: "100%" }}
        >
          <button
            type="button"
            aria-label="新增一条记录"
            onClick={onAddRecord}
            style={{ width: SELECT_COL_WIDTH }}
            className="sticky left-0 z-10 flex h-full shrink-0 items-center justify-center border-r border-border bg-table-body text-foreground transition-colors hover:bg-muted/50 cursor-pointer"
          >
            <PlusIcon className="size-4" aria-hidden="true" />
          </button>
        </div>
      </div>
      {frozenEdgeShadow && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 z-30 w-3 bg-gradient-to-r from-black/15 to-transparent dark:from-black/50"
          style={{ left: frozenEdge }}
        />
      )}
      </div>

      <footer className="flex h-10 shrink-0 items-center justify-between border-t border-border bg-background px-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center rounded-md bg-secondary px-2 py-0.5 font-normal text-secondary-foreground tabular-nums">
            {hasMore
              ? `已加载 ${rows.length} / ${totalRecords} 条记录`
              : `${rows.length} 条记录`}
          </span>
          {loadingMore && <span>正在加载更多</span>}
          {hasMore && !loadingMore && (
            <button
              type="button"
              onClick={onLoadMore}
              className="text-xs font-normal text-foreground hover:underline cursor-pointer"
            >
              加载更多
            </button>
          )}
          {selectedRecordIds.length > 0 && (
            <span>已选中 {selectedRecordIds.length} 条</span>
          )}
        </div>
        <span>共 {fields.length} 个字段</span>
      </footer>
    </div>
  );
}
