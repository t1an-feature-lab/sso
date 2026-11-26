"use client";

import { PlusIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  formatCellText,
  isValueEmpty,
  SELECT_COLOR_STYLES,
} from "@/lib/bitable/field-registry";
import type {
  FieldSchema,
  RecordData,
  RelationTargetItem,
  SelectOption,
  SelectOptionColor,
} from "@/lib/bitable/types";
import { cn } from "@/lib/utils";
import { OptionTagGroup } from "./record-fields";

interface KanbanViewProps {
  fields: FieldSchema[];
  records: RecordData[];
  groupByFieldId?: string;
  hiddenFieldIds: string[];
  relationTargets: Record<string, RelationTargetItem[]>;
  onOpenRecord: (record: RecordData) => void;
  onCreateRecordWithGroup: (fieldId: string, optionId: string | null) => void;
  onPlaceRecord: (
    recordId: string,
    fieldId: string,
    optionId: string | null,
    placement: { targetId: string; position: "before" | "after" } | null
  ) => void;
}

interface DragSession {
  recordId: string;
  pointerId: number;
  width: number;
  height: number;
  offsetX: number;
  offsetY: number;
  originX: number;
  originY: number;
  x: number;
  y: number;
  active: boolean;
  columnKey: string | null;
  index: number;
}

const DRAG_THRESHOLD = 5;

export function KanbanView({
  fields,
  records,
  groupByFieldId,
  hiddenFieldIds,
  relationTargets,
  onOpenRecord,
  onCreateRecordWithGroup,
  onPlaceRecord,
}: KanbanViewProps) {
  const selectFields = fields.filter((field) => field.type === "singleSelect");
  const activeGroupField =
    selectFields.find((field) => field.id === groupByFieldId) ?? selectFields[0];
  const primaryField = fields.find((field) => field.isPrimary) ?? fields[0];
  const boardRef = useRef<HTMLDivElement>(null);
  const columnsRef = useRef<KanbanColumn[]>([]);
  const dragRef = useRef<DragSession | null>(null);
  const [drag, setDrag] = useState<DragSession | null>(null);

  const preview = activeGroupField
    ? pickPreviewFields(fields, hiddenFieldIds, primaryField?.id, activeGroupField.id)
    : {};
  const options = activeGroupField?.config.options ?? [];
  const ungrouped = activeGroupField
    ? records.filter((record) => isUngrouped(record.values[activeGroupField.id], options))
    : [];
  const columns: KanbanColumn[] = activeGroupField
    ? [
        ...options.map((option) => ({
          key: option.id,
          optionId: option.id,
          name: option.name,
          color: option.color,
          records: records.filter(
            (record) => String(record.values[activeGroupField.id] ?? "") === option.id
          ),
        })),
        ...(ungrouped.length > 0
          ? [
              {
                key: "__ungrouped__",
                optionId: null,
                name: "未分组",
                color: "slate" as const,
                records: ungrouped,
              },
            ]
          : []),
      ]
    : [];
  columnsRef.current = columns;

  useEffect(() => {
    if (!drag?.active) return;
    const previous = document.body.style.cursor;
    document.body.style.cursor = "grabbing";
    return () => {
      document.body.style.cursor = previous;
    };
  }, [drag?.active]);

  if (!activeGroupField) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center">
        <p className="text-sm font-medium">看板视图需要至少一个单选字段</p>
        <p className="text-sm text-muted-foreground">
          请先在工具栏点击「新增字段」添加一个单选类型字段
        </p>
      </div>
    );
  }

  const draggedRecord = drag
    ? records.find((record) => record.id === drag.recordId)
    : undefined;

  function placeRecord(session: DragSession) {
    const column = columnsRef.current.find((item) => item.key === session.columnKey);
    if (!column || !activeGroupField) return;
    const others = column.records.filter((record) => record.id !== session.recordId);
    const placement =
      session.index < others.length
        ? { targetId: others[session.index].id, position: "before" as const }
        : others.length > 0
          ? {
              targetId: others[others.length - 1].id,
              position: "after" as const,
            }
          : null;
    onPlaceRecord(session.recordId, activeGroupField.id, column.optionId, placement);
  }

  function startPointer(event: React.PointerEvent<HTMLElement>, recordId: string) {
    if (event.button !== 0) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const session: DragSession = {
      recordId,
      pointerId: event.pointerId,
      width: rect.width,
      height: rect.height,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
      originX: event.clientX,
      originY: event.clientY,
      x: event.clientX,
      y: event.clientY,
      active: false,
      columnKey: null,
      index: 0,
    };
    dragRef.current = session;

    function move(pointerEvent: PointerEvent) {
      const current = dragRef.current;
      if (!current || pointerEvent.pointerId !== current.pointerId) return;
      const distance = Math.hypot(
        pointerEvent.clientX - current.originX,
        pointerEvent.clientY - current.originY
      );
      if (!current.active && distance < DRAG_THRESHOLD) return;
      current.active = true;
      current.x = pointerEvent.clientX;
      current.y = pointerEvent.clientY;
      const hit = locateDrop(
        boardRef.current,
        pointerEvent.clientX,
        pointerEvent.clientY,
        current.recordId,
        current.columnKey,
        current.index
      );
      current.columnKey = hit.columnKey;
      current.index = hit.index;
      setDrag({ ...current });
    }

    function end(pointerEvent: PointerEvent) {
      const current = dragRef.current;
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
      dragRef.current = null;
      setDrag(null);
      if (!current || pointerEvent.pointerId !== current.pointerId) return;
      if (!current.active) {
        const record = records.find((item) => item.id === current.recordId);
        if (record) onOpenRecord(record);
        return;
      }
      if (current.columnKey) placeRecord(current);
    }

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
  }

  return (
    <div
      ref={boardRef}
      className={cn(
        "flex min-h-0 flex-1 items-stretch gap-3 overflow-x-auto overflow-y-hidden bg-background p-3",
        drag?.active && "select-none"
      )}
    >
      {columns.map((column) => {
        const style = SELECT_COLOR_STYLES[column.color] ?? SELECT_COLOR_STYLES.slate;
        const slots = columnSlots(column, drag);
        return (
          <section
            key={column.key}
            aria-label={column.name}
            data-kanban-column={column.key}
            className={cn(
              "flex h-full min-h-0 w-72 shrink-0 flex-col gap-1 overflow-hidden rounded-xl bg-muted p-2",
              drag?.active && drag.columnKey === column.key && "bg-accent"
            )}
          >
            <div className="flex shrink-0 items-center gap-2 px-1.5 py-1">
              <span
                className={cn("size-2 shrink-0 rounded-full", style.dot)}
                aria-hidden="true"
              />
              <h2 className="min-w-0 flex-1 truncate text-sm font-medium">
                {column.name}
              </h2>
              <Badge variant="outline" className="bg-background tabular-nums">
                {column.records.length}
              </Badge>
            </div>

            <div
              data-kanban-list
              className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto overscroll-y-contain px-0.5 py-1"
            >
              {slots.map((slot) =>
                slot.type === "placeholder" && draggedRecord ? (
                  <div
                    key="placeholder"
                    data-kanban-placeholder
                    className="pointer-events-none"
                    style={{ minHeight: drag?.height }}
                  >
                    <KanbanCardFace
                      title={recordTitle(draggedRecord, primaryField, relationTargets)}
                      preview={preview}
                      record={draggedRecord}
                      relationTargets={relationTargets}
                      placeholder
                    />
                  </div>
                ) : slot.type === "card" ? (
                  <KanbanCard
                    key={slot.record.id}
                    record={slot.record}
                    title={recordTitle(slot.record, primaryField, relationTargets)}
                    preview={preview}
                    relationTargets={relationTargets}
                    onPointerDown={(event) => startPointer(event, slot.record.id)}
                    onOpen={() => onOpenRecord(slot.record)}
                  />
                ) : null
              )}
            </div>

            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() =>
                onCreateRecordWithGroup(activeGroupField.id, column.optionId)
              }
              className="w-full shrink-0 justify-center text-muted-foreground"
            >
              <PlusIcon aria-hidden="true" />
              新增记录
            </Button>
          </section>
        );
      })}

      {drag?.active && draggedRecord
        ? createPortal(
            <div
              className="pointer-events-none fixed top-0 left-0 z-50"
              style={{
                width: drag.width,
                transform: `translate3d(${drag.x - drag.offsetX}px, ${drag.y - drag.offsetY}px, 0)`,
              }}
            >
              <KanbanCardFace
                title={recordTitle(draggedRecord, primaryField, relationTargets)}
                preview={preview}
                record={draggedRecord}
                relationTargets={relationTargets}
                className="shadow-lg"
              />
            </div>,
            document.body
          )
        : null}
    </div>
  );
}

function KanbanCard({
  record,
  title,
  preview,
  relationTargets,
  onPointerDown,
  onOpen,
}: {
  record: RecordData;
  title: string;
  preview: PreviewFields;
  relationTargets: Record<string, RelationTargetItem[]>;
  onPointerDown: (event: React.PointerEvent<HTMLElement>) => void;
  onOpen: () => void;
}) {
  return (
    <div data-kanban-card data-record-id={record.id}>
      <KanbanCardFace
        title={title}
        preview={preview}
        record={record}
        relationTargets={relationTargets}
        interactive
        onPointerDown={onPointerDown}
        onOpen={onOpen}
      />
    </div>
  );
}

function KanbanCardFace({
  title,
  preview,
  record,
  relationTargets,
  interactive = false,
  placeholder = false,
  className,
  onPointerDown,
  onOpen,
}: {
  title: string;
  preview: PreviewFields;
  record: RecordData;
  relationTargets: Record<string, RelationTargetItem[]>;
  interactive?: boolean;
  placeholder?: boolean;
  className?: string;
  onPointerDown?: (event: React.PointerEvent<HTMLElement>) => void;
  onOpen?: () => void;
}) {
  const tags = preview.tags ? selectOptions(preview.tags, record.values[preview.tags.id]) : [];
  const owner = preview.owner
    ? formatCellText(preview.owner, record.values[preview.owner.id], relationTargets)
    : "";
  const date = preview.date
    ? formatCellText(preview.date, record.values[preview.date.id], relationTargets)
    : "";
  const amount = preview.number
    ? formatCellText(preview.number, record.values[preview.number.id], relationTargets)
    : "";
  const hasBody = tags.length > 0 || Boolean(owner || date || amount);

  return (
    <Card
      size="sm"
      className={cn(
        "shrink-0 rounded-xl shadow-none ring-0 [--card-spacing:--spacing(3)]",
        placeholder && "border border-dashed border-foreground/30 bg-background/55",
        className
      )}
    >
      <div
        role={interactive ? "button" : undefined}
        tabIndex={interactive ? 0 : undefined}
        aria-label={interactive ? `打开记录 ${title}` : undefined}
        onPointerDown={onPointerDown}
        onKeyDown={
          interactive
            ? (event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onOpen?.();
                }
              }
            : undefined
        }
        className={cn(
          "flex flex-col gap-2 rounded-xl text-left outline-none",
          placeholder && "opacity-45",
          interactive &&
            "cursor-grab focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset"
        )}
      >
        <CardHeader className="min-w-0">
          <CardTitle className="line-clamp-2">{title}</CardTitle>
        </CardHeader>
        {hasBody && (
          <CardContent className="gap-2">
            {tags.length > 0 && <OptionTagGroup options={tags} />}
            {(owner || date || amount) && (
              <div className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
                {owner && (
                  <span className="inline-flex min-w-0 flex-1 items-center gap-1.5">
                    <span
                      className="flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium text-foreground"
                      aria-hidden="true"
                    >
                      {owner.slice(0, 1)}
                    </span>
                    <span className="truncate">{owner}</span>
                  </span>
                )}
                {amount && <span className="shrink-0 tabular-nums">{amount}</span>}
                {date && (
                  <span className="ml-auto shrink-0 tabular-nums">{date}</span>
                )}
              </div>
            )}
          </CardContent>
        )}
      </div>
    </Card>
  );
}

function columnSlots(column: KanbanColumn, drag: DragSession | null): KanbanSlot[] {
  if (!drag?.active) {
    return column.records.map((record) => ({ type: "card", record }));
  }
  const cards = column.records.filter((record) => record.id !== drag.recordId);
  const isTarget = drag.columnKey === column.key;
  const isHome =
    drag.columnKey === null &&
    column.records.some((record) => record.id === drag.recordId);
  if (!isTarget && !isHome) {
    return cards.map((record) => ({ type: "card", record }));
  }
  const homeIndex = column.records.findIndex((record) => record.id === drag.recordId);
  const insertAt = isTarget
    ? Math.max(0, Math.min(drag.index, cards.length))
    : Math.max(0, homeIndex);
  const slots: KanbanSlot[] = cards.map((record) => ({ type: "card", record }));
  slots.splice(Math.min(insertAt, slots.length), 0, { type: "placeholder" });
  return slots;
}

function locateDrop(
  board: HTMLElement | null,
  x: number,
  y: number,
  recordId: string,
  previousColumn: string | null,
  previousIndex: number
): { columnKey: string | null; index: number } {
  if (!board) return { columnKey: null, index: previousIndex };
  const columnEl = [...board.querySelectorAll<HTMLElement>("[data-kanban-column]")].find(
    (element) => {
      const rect = element.getBoundingClientRect();
      return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
    }
  );
  if (!columnEl) return { columnKey: null, index: previousIndex };
  const columnKey = columnEl.dataset.kanbanColumn ?? null;
  const placeholder = columnEl.querySelector<HTMLElement>("[data-kanban-placeholder]");
  if (placeholder && columnKey === previousColumn) {
    const rect = placeholder.getBoundingClientRect();
    if (y >= rect.top && y <= rect.bottom) {
      return { columnKey, index: previousIndex };
    }
  }
  const cards = [...columnEl.querySelectorAll<HTMLElement>("[data-kanban-card]")].filter(
    (element) => element.dataset.recordId !== recordId
  );
  let index = cards.length;
  for (let i = 0; i < cards.length; i += 1) {
    const rect = cards[i].getBoundingClientRect();
    if (y < rect.top + rect.height / 2) {
      index = i;
      break;
    }
  }
  return { columnKey, index };
}

interface PreviewFields {
  tags?: FieldSchema;
  owner?: FieldSchema;
  date?: FieldSchema;
  number?: FieldSchema;
}

interface KanbanColumn {
  key: string;
  optionId: string | null;
  name: string;
  color: SelectOptionColor;
  records: RecordData[];
}

type KanbanSlot =
  | { type: "card"; record: RecordData }
  | { type: "placeholder" };

function pickPreviewFields(
  fields: FieldSchema[],
  hiddenFieldIds: string[],
  primaryId: string | undefined,
  groupId: string
): PreviewFields {
  const visible = fields.filter(
    (field) =>
      field.id !== primaryId &&
      field.id !== groupId &&
      !hiddenFieldIds.includes(field.id)
  );
  return {
    tags: visible.find((field) => field.type === "multiSelect"),
    owner: visible.find((field) => field.type === "relation"),
    date: visible.find((field) => field.type === "date" || field.type === "datetime"),
    number: visible.find((field) => field.type === "number"),
  };
}

function selectOptions(field: FieldSchema, value: unknown): SelectOption[] {
  if (isValueEmpty(value) || !Array.isArray(value)) return [];
  return value
    .map((id) => field.config.options?.find((option) => option.id === String(id)))
    .filter((option): option is SelectOption => Boolean(option));
}

function isUngrouped(value: unknown, options: Array<{ id: string }>): boolean {
  return (
    value === null ||
    value === undefined ||
    value === "" ||
    !options.some((option) => option.id === String(value))
  );
}

function recordTitle(
  record: RecordData,
  primaryField: FieldSchema | undefined,
  relationTargets: Record<string, RelationTargetItem[]>
): string {
  const text =
    primaryField &&
    formatCellText(primaryField, record.values[primaryField.id], relationTargets);
  return text || "未命名记录";
}
