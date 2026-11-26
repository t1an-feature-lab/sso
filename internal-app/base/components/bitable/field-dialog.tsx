"use client";

import { PlusIcon, Trash2Icon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FIELD_REGISTRY,
  FIELD_TYPE_LIST,
  SELECT_COLOR_LIST,
  SELECT_COLOR_STYLES,
} from "@/lib/bitable/field-registry";
import type {
  FieldConfig,
  FieldSchema,
  FieldType,
  SelectOption,
  SelectOptionColor,
  TableSummary,
} from "@/lib/bitable/types";
import { cn } from "@/lib/utils";

interface FieldDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingField: FieldSchema | null;
  tables: TableSummary[];
  currentTableId: string;
  onSave: (input: {
    id?: string;
    name: string;
    type: FieldType;
    required: boolean;
    config: FieldConfig;
  }) => Promise<void>;
}

function createOption(index: number): SelectOption {
  const color = SELECT_COLOR_LIST[index % SELECT_COLOR_LIST.length];
  return {
    id: `opt_${Date.now().toString(36)}_${index}`,
    name: `选项 ${index + 1}`,
    color,
  };
}

function FieldDialogForm({
  editingField,
  selectableTables,
  onClose,
  onSave,
}: {
  editingField: FieldSchema | null;
  selectableTables: TableSummary[];
  onClose: () => void;
  onSave: FieldDialogProps["onSave"];
}) {
  const [name, setName] = useState(editingField?.name ?? "");
  const [type, setType] = useState<FieldType>(editingField?.type ?? "text");
  const [required, setRequired] = useState(editingField?.required ?? false);
  const [precision, setPrecision] = useState(
    editingField?.config.precision !== undefined
      ? String(editingField.config.precision)
      : ""
  );
  const [options, setOptions] = useState<SelectOption[]>(() =>
    editingField?.config.options?.length
      ? editingField.config.options
      : [createOption(0), createOption(1)]
  );
  const [relationTableId, setRelationTableId] = useState(
    editingField?.config.relationTableId ?? selectableTables[0]?.id ?? ""
  );
  const [relationMultiple, setRelationMultiple] = useState(
    editingField ? editingField.config.multiple !== false : true
  );
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      toast.error("请输入字段名称");
      return;
    }

    const config: FieldConfig = {};
    if (type === "number" && precision.trim() !== "") {
      const p = Number(precision);
      if (Number.isInteger(p) && p >= 0 && p <= 6) {
        config.precision = p;
      }
    }
    if (type === "singleSelect" || type === "multiSelect") {
      const validOptions = options
        .map((opt) => ({ ...opt, name: opt.name.trim() }))
        .filter((opt) => opt.name.length > 0);
      if (validOptions.length === 0) {
        toast.error("请至少添加一个有效选项");
        return;
      }
      config.options = validOptions;
    }
    if (type === "relation") {
      if (!relationTableId) {
        toast.error("请选择要关联的目标数据表");
        return;
      }
      config.relationTableId = relationTableId;
      config.multiple = relationMultiple;
    }

    setSubmitting(true);
    try {
      await onSave({
        id: editingField?.id,
        name: trimmedName,
        type,
        required,
        config,
      });
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "保存字段失败");
    } finally {
      setSubmitting(false);
    }
  }

  const currentTypeDef = FIELD_REGISTRY[type];
  const currentRelTable = selectableTables.find((t) => t.id === relationTableId);

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="field-name-input">字段名称</Label>
        <Input
          id="field-name-input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="例如：负责人、金额、截止日期"
          required
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label>数据类型</Label>
        <Select
          value={type}
          disabled={Boolean(editingField?.isPrimary)}
          onValueChange={(next) => {
            if (next) setType(next as FieldType);
          }}
        >
          <SelectTrigger className="w-full">
            <SelectValue>
              {() => (
                <span className="flex items-center gap-2">
                  <span>{currentTypeDef.label}</span>
                  <span className="font-mono text-xs text-muted-foreground">
                    {currentTypeDef.sqlType}
                  </span>
                </span>
              )}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {FIELD_TYPE_LIST.map((def) => (
              <SelectItem key={def.type} value={def.type}>
                <span>{def.label}</span>
                <span className="font-mono text-xs text-muted-foreground">
                  {def.sqlType}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {type === "number" && (
        <div className="flex flex-col gap-2">
          <Label htmlFor="field-precision-input">
            小数位数（0-6，留空按原值显示）
          </Label>
          <Input
            id="field-precision-input"
            type="number"
            min={0}
            max={6}
            value={precision}
            onChange={(e) => setPrecision(e.target.value)}
            placeholder="例如：2"
          />
        </div>
      )}

      {(type === "singleSelect" || type === "multiSelect") && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">预设选项</span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                setOptions((prev) => [...prev, createOption(prev.length)])
              }
            >
              <PlusIcon className="size-4" aria-hidden="true" />
              添加选项
            </Button>
          </div>
          <div className="flex max-h-52 flex-col gap-2 overflow-y-auto pr-1">
            {options.map((opt, idx) => {
              const style =
                SELECT_COLOR_STYLES[opt.color] ?? SELECT_COLOR_STYLES.slate;
              return (
                <div key={opt.id} className="flex items-center gap-2">
                  <button
                    type="button"
                    aria-label={`切换选项 ${opt.name} 颜色`}
                    onClick={() => {
                      const nextColor: SelectOptionColor =
                        SELECT_COLOR_LIST[
                          (SELECT_COLOR_LIST.indexOf(opt.color) + 1) %
                            SELECT_COLOR_LIST.length
                        ];
                      setOptions((prev) =>
                        prev.map((item) =>
                          item.id === opt.id
                            ? { ...item, color: nextColor }
                            : item
                        )
                      );
                    }}
                    className={cn(
                      "flex size-7 shrink-0 items-center justify-center rounded-md border cursor-pointer",
                      style.bg,
                      style.border
                    )}
                    title="点击切换颜色"
                  >
                    <span className={cn("size-2.5 rounded-full", style.dot)} />
                  </button>
                  <Input
                    value={opt.name}
                    aria-label={`选项 ${idx + 1} 名称`}
                    onChange={(e) =>
                      setOptions((prev) =>
                        prev.map((item) =>
                          item.id === opt.id
                            ? { ...item, name: e.target.value }
                            : item
                        )
                      )
                    }
                    className="h-8 flex-1 text-xs"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`删除选项 ${opt.name}`}
                    onClick={() =>
                      setOptions((prev) =>
                        prev.filter((item) => item.id !== opt.id)
                      )
                    }
                    className="text-foreground hover:text-destructive"
                  >
                    <Trash2Icon className="size-4" aria-hidden="true" />
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {type === "relation" && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label>关联目标数据表</Label>
            <Select
              value={relationTableId}
              onValueChange={(next) => {
                if (next) setRelationTableId(next);
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue>
                  {() => currentRelTable?.name ?? "请选择数据表"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {selectableTables.map((table) => (
                  <SelectItem key={table.id} value={table.id}>
                    {table.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <Checkbox
              checked={relationMultiple}
              onCheckedChange={(next) => setRelationMultiple(Boolean(next))}
            />
            允许关联多条记录
          </label>
        </div>
      )}

      <label className="flex items-center gap-2 text-sm cursor-pointer">
        <Checkbox
          checked={required}
          onCheckedChange={(next) => setRequired(Boolean(next))}
        />
        必填字段
      </label>

      <DialogFooter>
        <DialogClose render={<Button variant="outline" />}>取消</DialogClose>
        <Button type="submit" disabled={submitting}>
          {submitting ? "保存中..." : editingField ? "保存字段" : "创建字段"}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function FieldDialog({
  open,
  onOpenChange,
  editingField,
  tables,
  currentTableId,
  onSave,
}: FieldDialogProps) {
  const otherTables = tables.filter((t) => t.id !== currentTableId);
  const selectableTables = otherTables.length > 0 ? otherTables : tables;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editingField ? "编辑字段" : "新增字段"}</DialogTitle>
        </DialogHeader>

        {open && (
          <FieldDialogForm
            key={editingField?.id ?? "__new__"}
            editingField={editingField}
            selectableTables={selectableTables}
            onClose={() => onOpenChange(false)}
            onSave={onSave}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
