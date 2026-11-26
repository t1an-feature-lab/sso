"use client";

import {
  ArrowDownIcon,
  ArrowUpIcon,
  EyeOffIcon,
  Link2Icon,
  PencilIcon,
  Trash2Icon,
} from "lucide-react";
import { type ReactElement, useState } from "react";
import { toast } from "sonner";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import type { FieldSchema } from "@/lib/bitable/types";

function CountInput({
  value,
  label,
  onChange,
  onSubmit,
}: {
  value: string;
  label: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
}) {
  return (
    <Input
      aria-label={label}
      inputMode="numeric"
      value={value}
      className="h-6 w-9 px-0 text-center text-[13px]"
      onPointerDown={(event) => event.stopPropagation()}
      onMouseDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => {
        event.stopPropagation();
        if (event.key === "Enter") {
          event.preventDefault();
          onSubmit();
        }
      }}
      onChange={(event) => {
        onChange(event.target.value.replace(/\D/g, "").slice(0, 2));
      }}
    />
  );
}

function parseInsertCount(raw: string): number | null {
  if (!raw) return null;
  const count = Number(raw);
  if (!Number.isInteger(count) || count < 1 || count > 20) return null;
  return count;
}

export function FieldHeaderMenu({
  field,
  trigger,
  onSortField,
  onEditField,
  onHideField,
  onDeleteField,
}: {
  field: FieldSchema;
  trigger: ReactElement;
  onSortField: (fieldId: string, direction: "asc" | "desc") => void;
  onEditField: (field: FieldSchema) => void;
  onHideField: (fieldId: string) => void;
  onDeleteField: (field: FieldSchema) => void;
}) {
  return (
    <ContextMenu>
      <ContextMenuTrigger render={trigger} />
      <ContextMenuContent className="min-w-44">
        <ContextMenuItem onClick={() => onSortField(field.id, "asc")}>
          <ArrowUpIcon aria-hidden="true" />
          按此列升序
        </ContextMenuItem>
        <ContextMenuItem onClick={() => onSortField(field.id, "desc")}>
          <ArrowDownIcon aria-hidden="true" />
          按此列降序
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onClick={() => onEditField(field)}>
          <PencilIcon aria-hidden="true" />
          编辑字段配置
        </ContextMenuItem>
        {!field.isPrimary && (
          <ContextMenuItem onClick={() => onHideField(field.id)}>
            <EyeOffIcon aria-hidden="true" />
            隐藏字段
          </ContextMenuItem>
        )}
        {!field.isPrimary && (
          <ContextMenuItem
            variant="destructive"
            onClick={() => onDeleteField(field)}
          >
            <Trash2Icon aria-hidden="true" />
            删除字段
          </ContextMenuItem>
        )}
      </ContextMenuContent>
    </ContextMenu>
  );
}

export function RecordRowMenu({
  recordTitle,
  trigger,
  onInsert,
  onCopyLink,
  onDelete,
}: {
  recordTitle: string;
  trigger: ReactElement;
  onInsert: (position: "before" | "after", count: number) => void;
  onCopyLink: () => void;
  onDelete: () => void;
}) {
  const confirm = useConfirm();
  const [open, setOpen] = useState(false);
  const [aboveCount, setAboveCount] = useState("1");
  const [belowCount, setBelowCount] = useState("1");

  function insert(position: "before" | "after", raw: string) {
    const count = parseInsertCount(raw);
    if (!count) {
      toast.error("插入条数需要在 1 到 20 之间");
      return;
    }
    setOpen(false);
    onInsert(position, count);
  }

  async function remove() {
    setOpen(false);
    const yes = await confirm({
      title: `删除记录「${recordTitle}」？`,
      description: "删除后将同步移除关联关系边且不可恢复",
      confirmLabel: "删除",
      cancelLabel: "取消",
      destructive: true,
    });
    if (!yes) return;
    onDelete();
  }

  return (
    <ContextMenu open={open} onOpenChange={setOpen}>
      <ContextMenuTrigger render={trigger} />
      <ContextMenuContent className="w-60">
        <ContextMenuItem
          closeOnClick={false}
          onClick={(event) => {
            const target = event.target;
            if (target instanceof Element && target.closest("input")) return;
            insert("before", aboveCount);
          }}
        >
          <ArrowUpIcon aria-hidden="true" />
          <span>在上方插入</span>
          <CountInput
            value={aboveCount}
            label="在上方插入的条数"
            onChange={setAboveCount}
            onSubmit={() => insert("before", aboveCount)}
          />
          <span>记录</span>
        </ContextMenuItem>
        <ContextMenuItem
          closeOnClick={false}
          onClick={(event) => {
            const target = event.target;
            if (target instanceof Element && target.closest("input")) return;
            insert("after", belowCount);
          }}
        >
          <ArrowDownIcon aria-hidden="true" />
          <span>在下方插入</span>
          <CountInput
            value={belowCount}
            label="在下方插入的条数"
            onChange={setBelowCount}
            onSubmit={() => insert("after", belowCount)}
          />
          <span>记录</span>
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem
          onClick={() => {
            setOpen(false);
            onCopyLink();
          }}
        >
          <Link2Icon aria-hidden="true" />
          复制记录链接
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem variant="destructive" onClick={() => void remove()}>
          <Trash2Icon aria-hidden="true" />
          删除记录
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
