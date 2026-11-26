"use client";

import { CheckIcon, ExternalLinkIcon, Link2Icon, SearchIcon, XIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
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
import { Textarea } from "@/components/ui/textarea";
import { formatCellText } from "@/lib/bitable/field-registry";
import type { FieldSchema, RelationTargetItem } from "@/lib/bitable/types";
import { cn } from "@/lib/utils";
import { DateField } from "./date-field";
import { OptionBadge, OptionTagGroup } from "./record-fields";

interface CellProps {
  field: FieldSchema;
  value: unknown;
  relationTargets: Record<string, RelationTargetItem[]>;
  onChange: (nextValue: unknown) => void;
}

export function CellDisplay({
  field,
  value,
  relationTargets,
}: Omit<CellProps, "onChange">) {
  if (field.type === "boolean") {
    return (
      <span className="text-xs text-muted-foreground">
        {value ? "是" : "否"}
      </span>
    );
  }

  if (field.type === "singleSelect") {
    const id = value ? String(value) : "";
    const option = field.config.options?.find((o) => o.id === id);
    if (!option) return null;
    return <OptionBadge name={option.name} color={option.color} />;
  }

  if (field.type === "multiSelect") {
    const ids = Array.isArray(value) ? value.map(String) : [];
    const options = ids
      .map((id) => field.config.options?.find((option) => option.id === id))
      .filter((option): option is NonNullable<typeof option> => Boolean(option));
    if (options.length === 0) return null;
    return <OptionTagGroup options={options} />;
  }

  if (field.type === "relation") {
    const ids = Array.isArray(value) ? value.map(String) : [];
    if (ids.length === 0) return null;
    const targets = field.config.relationTableId
      ? relationTargets[field.config.relationTableId] ?? []
      : [];
    return (
      <div className="flex min-w-0 items-center gap-1 overflow-hidden">
        {ids.map((id) => {
          const item = targets.find((t) => t.id === id);
          return (
            <span
              key={id}
              className="inline-flex shrink-0 items-center gap-1 rounded-md border border-border bg-secondary px-1.5 py-0.5 text-xs text-secondary-foreground"
            >
              <Link2Icon
                className="size-3 shrink-0 text-muted-foreground"
                aria-hidden="true"
              />
              <span>{item?.label ?? id.slice(0, 8)}</span>
            </span>
          );
        })}
      </div>
    );
  }

  if (field.type === "json") {
    const text = formatCellText(field, value, relationTargets);
    if (!text) return null;
    return (
      <span className="bitable-cell-truncate font-mono text-xs text-muted-foreground">
        {text}
      </span>
    );
  }

  if (field.type === "url") {
    const text = formatCellText(field, value, relationTargets);
    if (!text) return null;
    const href = /^https?:\/\//i.test(text) ? text : `https://${text}`;
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        className="bitable-cell-truncate text-[13px] text-blue-600 underline underline-offset-4 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
      >
        {text}
      </a>
    );
  }

  const text = formatCellText(field, value, relationTargets);
  if (!text) return null;

  return (
    <span
      className={cn(
        "bitable-cell-truncate text-[13px]",
        field.type === "number" && "w-full text-right tabular-nums"
      )}
    >
      {text}
    </span>
  );
}

function InlineInputCell({
  field,
  value,
  onChange,
}: Omit<CellProps, "relationTargets">) {
  const stringVal =
    value === null || value === undefined ? "" : String(value);
  const [draft, setDraft] = useState<string | null>(null);
  const isEditing = draft !== null;

  const formattedNumber =
    field.type === "number" && typeof value === "number" && Number.isFinite(value)
      ? typeof field.config.precision === "number"
        ? value.toLocaleString("zh-CN", {
            minimumFractionDigits: field.config.precision,
            maximumFractionDigits: field.config.precision,
          })
        : value.toLocaleString("zh-CN")
      : stringVal;

  const displayValue = isEditing
    ? draft
    : field.type === "number"
      ? formattedNumber
      : stringVal;

  function startEdit() {
    setDraft(stringVal);
  }

  function commit() {
    if (draft === null) return;
    const raw = draft;
    setDraft(null);
    if (field.type === "number") {
      if (raw.trim() === "") {
        if (value !== null && value !== undefined) onChange(null);
        return;
      }
      const parsed = Number(raw);
      if (!Number.isFinite(parsed)) {
        toast.error("请输入有效数字");
        return;
      }
      if (parsed !== value) onChange(parsed);
      return;
    }
    if (raw !== (value ?? "")) onChange(raw);
  }

  const inputType =
    field.type === "number"
      ? isEditing
        ? "number"
        : "text"
      : field.type === "email"
        ? "email"
        : field.type === "url"
          ? "url"
          : "text";

  return (
    <div className="group/cell flex h-full w-full items-center">
      <Input
        type={inputType}
        step={field.type === "number" ? "any" : undefined}
        value={displayValue}
        aria-label={field.name}
        onFocus={startEdit}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            e.currentTarget.blur();
          } else if (e.key === "Escape") {
            e.preventDefault();
            setDraft(null);
            e.currentTarget.blur();
          }
        }}
        className={cn(
          "h-full rounded-none border-0 bg-transparent px-2.5 text-[13px] shadow-none focus-visible:border-0 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/70 dark:bg-transparent",
          field.type === "number" && "text-right tabular-nums",
          field.type === "url" && "text-blue-600 dark:text-blue-400",
          field.type === "url" &&
            !isEditing &&
            stringVal &&
            "underline underline-offset-4"
        )}
      />
      {field.type === "url" && stringVal && (
        <a
          href={
            /^https?:\/\//i.test(stringVal)
              ? stringVal
              : `https://${stringVal}`
          }
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`打开链接 ${stringVal}`}
          className="mr-1.5 hidden size-6 shrink-0 items-center justify-center rounded-md text-blue-600 hover:bg-accent hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 group-hover/cell:inline-flex"
        >
          <ExternalLinkIcon className="size-4" aria-hidden="true" />
        </a>
      )}
    </div>
  );
}

function MultiSelectPopoverCell({
  field,
  value,
  relationTargets,
  onChange,
  variant = "cell",
  id,
}: CellProps & { variant?: "cell" | "form"; id?: string }) {
  const options = field.config.options ?? [];
  const selectedIds = Array.isArray(value) ? value.map(String) : [];

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            id={id}
            type="button"
            variant={variant === "form" ? "outline" : "ghost"}
            aria-label={`选择${field.name}`}
            className={cn(
              "w-full justify-between font-normal whitespace-normal",
              variant === "cell"
                ? "h-full rounded-none px-2.5 shadow-none hover:bg-transparent"
                : "h-auto min-h-9 px-2.5 py-1.5"
            )}
          />
        }
      >
        <div className="min-w-0 flex-1">
          {selectedIds.length > 0 ? (
            <CellDisplay
              field={field}
              value={value}
              relationTargets={relationTargets}
            />
          ) : variant === "form" ? (
            <span className="text-muted-foreground">请选择</span>
          ) : null}
        </div>
      </PopoverTrigger>
      <PopoverContent align="start" sideOffset={4} className="w-60 p-2">
        <PopoverTitle className="px-1.5 pt-0.5">{field.name}</PopoverTitle>
        {options.length === 0 ? (
          <p className="px-1.5 py-2 text-xs text-muted-foreground">
            暂无预设选项
          </p>
        ) : (
          <div className="flex max-h-60 flex-col gap-0.5 overflow-y-auto">
            {options.map((opt) => {
              const selected = selectedIds.includes(opt.id);
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => {
                    const next = selected
                      ? selectedIds.filter((id) => id !== opt.id)
                      : [...selectedIds, opt.id];
                    onChange(next);
                  }}
                  className="flex w-full items-center justify-between gap-2 rounded-sm px-2 py-1.5 text-left text-xs hover:bg-accent cursor-pointer"
                >
                  <OptionBadge name={opt.name} color={opt.color} />
                  {selected && (
                    <CheckIcon className="size-4 shrink-0" aria-hidden="true" />
                  )}
                </button>
              );
            })}
          </div>
        )}
        {selectedIds.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onChange([])}
            className="w-full justify-center text-foreground"
          >
            <XIcon className="size-4" aria-hidden="true" />
            清空选择
          </Button>
        )}
      </PopoverContent>
    </Popover>
  );
}

function RelationPopoverCell({
  field,
  value,
  relationTargets,
  onChange,
  variant = "cell",
  id,
}: CellProps & { variant?: "cell" | "form"; id?: string }) {
  const [query, setQuery] = useState("");
  const targetTableId = field.config.relationTableId;
  const multiple = field.config.multiple !== false;
  const selectedIds = Array.isArray(value) ? value.map(String) : [];

  const filteredTargets = useMemo(() => {
    const targets = targetTableId ? relationTargets[targetTableId] ?? [] : [];
    const q = query.trim().toLowerCase();
    if (!q) return targets;
    return targets.filter((t) => t.label.toLowerCase().includes(q));
  }, [targetTableId, relationTargets, query]);

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            id={id}
            type="button"
            variant={variant === "form" ? "outline" : "ghost"}
            aria-label={`选择关联记录 ${field.name}`}
            className={cn(
              "w-full justify-between font-normal whitespace-normal",
              variant === "cell"
                ? "h-full rounded-none px-2.5 shadow-none hover:bg-transparent"
                : "h-auto min-h-9 px-2.5 py-1.5"
            )}
          />
        }
      >
        <div className="min-w-0 flex-1">
          {selectedIds.length > 0 ? (
            <CellDisplay
              field={field}
              value={value}
              relationTargets={relationTargets}
            />
          ) : variant === "form" ? (
            <span className="text-muted-foreground">选择关联记录</span>
          ) : null}
        </div>
      </PopoverTrigger>
      <PopoverContent align="start" sideOffset={4} className="w-64 p-2">
        <div className="relative">
          <SearchIcon
            className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-foreground/70"
            aria-hidden="true"
          />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label={`搜索${field.name}`}
            placeholder="搜索关联记录"
            className="h-8 pl-8.5 text-sm"
          />
        </div>

        {!targetTableId ? (
          <p className="px-1.5 py-2 text-xs text-muted-foreground">
            尚未配置关联目标表
          </p>
        ) : filteredTargets.length === 0 ? (
          <p className="px-1.5 py-2 text-xs text-muted-foreground">
            没有匹配的记录
          </p>
        ) : (
          <div className="flex max-h-56 flex-col gap-0.5 overflow-y-auto">
            {filteredTargets.map((item) => {
              const selected = selectedIds.includes(item.id);
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    if (multiple) {
                      const next = selected
                        ? selectedIds.filter((id) => id !== item.id)
                        : [...selectedIds, item.id];
                      onChange(next);
                    } else {
                      onChange(selected ? [] : [item.id]);
                    }
                  }}
                  className="flex w-full items-center justify-between gap-2 rounded-sm px-2 py-1.5 text-left text-[13px] hover:bg-accent cursor-pointer"
                >
                  <span className="bitable-cell-truncate">{item.label}</span>
                  {selected && (
                    <CheckIcon className="size-4 shrink-0" aria-hidden="true" />
                  )}
                </button>
              );
            })}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

function JsonCellPopover({
  field,
  value,
  relationTargets,
  onChange,
}: CellProps) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");

  function handleOpenChange(nextOpen: boolean) {
    if (nextOpen) {
      setText(
        value === null || value === undefined
          ? ""
          : typeof value === "string"
            ? value
            : JSON.stringify(value, null, 2)
      );
    }
    setOpen(nextOpen);
  }

  function handleSave() {
    const trimmed = text.trim();
    if (!trimmed) {
      onChange(null);
      setOpen(false);
      return;
    }
    try {
      const parsed = JSON.parse(trimmed);
      onChange(parsed);
      setOpen(false);
    } catch {
      toast.error("JSON 格式不正确，请检查语法");
    }
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger
        render={
          <button
            type="button"
            aria-label={`编辑 ${field.name}`}
            className="flex h-full w-full items-center px-2.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/70 cursor-pointer"
          />
        }
      >
        <CellDisplay
          field={field}
          value={value}
          relationTargets={relationTargets}
        />
      </PopoverTrigger>
      <PopoverContent align="start" sideOffset={4} className="w-80">
        <PopoverTitle>编辑 JSON（{field.name}）</PopoverTitle>
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          aria-label={`${field.name} JSON 内容`}
          placeholder='{"key": "value"}'
          rows={6}
          className="font-mono text-xs"
        />
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
            取消
          </Button>
          <Button size="sm" onClick={handleSave}>
            保存
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function GridCellEditor({
  field,
  value,
  relationTargets,
  onChange,
}: CellProps) {
  if (field.type === "date" || field.type === "datetime") {
    return (
      <DateField
        variant="cell"
        withTime={field.type === "datetime"}
        value={value}
        onChange={onChange}
        aria-label={field.name}
      />
    );
  }

  if (field.type === "boolean") {
    return (
      <div className="flex h-full w-full items-center justify-center px-2">
        <Checkbox
          checked={Boolean(value)}
          onCheckedChange={(next) => onChange(Boolean(next))}
          aria-label={field.name}
        />
      </div>
    );
  }

  if (field.type === "singleSelect") {
    const options = field.config.options ?? [];
    const current = value ? String(value) : "";

    return (
      <Select
        value={current}
        onValueChange={(next) => {
          const resolved = next || null;
          if (resolved !== (value ?? null)) onChange(resolved);
        }}
      >
        <SelectTrigger
          aria-label={field.name}
          className="h-full w-full rounded-none border-0 bg-transparent px-2.5 shadow-none focus-visible:border-0 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/70 dark:bg-transparent [&>svg]:opacity-0 hover:[&>svg]:opacity-100 data-popup-open:[&>svg]:opacity-100"
        >
          <SelectValue>
            {() => (
              <CellDisplay
                field={field}
                value={value}
                relationTargets={relationTargets}
              />
            )}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="">
            <span className="text-muted-foreground">清空</span>
          </SelectItem>
          {options.map((opt) => (
            <SelectItem key={opt.id} value={opt.id}>
              <OptionBadge name={opt.name} color={opt.color} />
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  if (field.type === "multiSelect") {
    return (
      <MultiSelectPopoverCell
        field={field}
        value={value}
        relationTargets={relationTargets}
        onChange={onChange}
      />
    );
  }

  if (field.type === "relation") {
    return (
      <RelationPopoverCell
        field={field}
        value={value}
        relationTargets={relationTargets}
        onChange={onChange}
      />
    );
  }

  if (field.type === "json") {
    return (
      <JsonCellPopover
        field={field}
        value={value}
        relationTargets={relationTargets}
        onChange={onChange}
      />
    );
  }

  return <InlineInputCell field={field} value={value} onChange={onChange} />;
}

export function FieldFormControl({
  field,
  value,
  relationTargets,
  onChange,
  id,
}: CellProps & { id?: string }) {
  const [jsonDraft, setJsonDraft] = useState<string | null>(null);
  const formattedJson =
    field.type === "json" && value !== null && value !== undefined
      ? typeof value === "string"
        ? value
        : JSON.stringify(value, null, 2)
      : "";
  const jsonText = jsonDraft ?? formattedJson;

  if (field.type === "boolean") {
    return (
      <div className="flex items-center gap-2 text-sm">
        <Checkbox
          id={id}
          checked={Boolean(value)}
          onCheckedChange={(next) => onChange(Boolean(next))}
        />
        <label htmlFor={id} className="cursor-pointer">
          {value ? "已开启" : "未开启"}
        </label>
      </div>
    );
  }

  if (field.type === "singleSelect") {
    const options = field.config.options ?? [];
    const current = value ? String(value) : "";
    return (
      <Select
        value={current}
        onValueChange={(next) => onChange(next || null)}
      >
        <SelectTrigger id={id} className="w-full">
          <SelectValue>
            {() =>
              current ? (
                <CellDisplay
                  field={field}
                  value={value}
                  relationTargets={relationTargets}
                />
              ) : (
                <span className="text-muted-foreground">请选择</span>
              )
            }
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="">
            <span className="text-muted-foreground">清空</span>
          </SelectItem>
          {options.map((opt) => (
            <SelectItem key={opt.id} value={opt.id}>
              <OptionBadge name={opt.name} color={opt.color} />
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  if (field.type === "multiSelect") {
    return (
      <MultiSelectPopoverCell
        id={id}
        field={field}
        value={value}
        relationTargets={relationTargets}
        onChange={onChange}
        variant="form"
      />
    );
  }

  if (field.type === "relation") {
    return (
      <RelationPopoverCell
        id={id}
        field={field}
        value={value}
        relationTargets={relationTargets}
        onChange={onChange}
        variant="form"
      />
    );
  }

  if (field.type === "json") {
    return (
      <Textarea
        id={id}
        value={jsonText}
        onChange={(e) => setJsonDraft(e.target.value)}
        onBlur={() => {
          if (jsonDraft === null) return;
          const trimmed = jsonDraft.trim();
          if (!trimmed) {
            onChange(null);
            setJsonDraft(null);
            return;
          }
          try {
            onChange(JSON.parse(trimmed));
            setJsonDraft(null);
          } catch {
            toast.error("JSON 格式不正确");
          }
        }}
        rows={4}
        placeholder='{"key": "value"}'
        className="font-mono text-xs"
      />
    );
  }

  if (field.type === "number") {
    return (
      <Input
        id={id}
        type="number"
        step="any"
        value={value === null || value === undefined ? "" : String(value)}
        onChange={(e) => {
          const next = e.target.value;
          if (next.trim() === "") {
            onChange(null);
            return;
          }
          const num = Number(next);
          if (Number.isFinite(num)) onChange(num);
        }}
        placeholder="输入数字"
      />
    );
  }

  if (field.type === "date" || field.type === "datetime") {
    return (
      <DateField
        id={id}
        variant="form"
        withTime={field.type === "datetime"}
        value={value}
        onChange={onChange}
        aria-label={field.name}
      />
    );
  }

  return (
    <Input
      id={id}
      type={
        field.type === "email"
          ? "email"
          : field.type === "url"
            ? "url"
            : "text"
      }
      value={value === null || value === undefined ? "" : String(value)}
      onChange={(e) => onChange(e.target.value)}
      placeholder={`输入${field.name}`}
    />
  );
}
