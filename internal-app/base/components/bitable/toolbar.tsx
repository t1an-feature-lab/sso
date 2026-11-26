"use client";

import {
  ArrowUpDownIcon,
  CheckIcon,
  EyeOffIcon,
  FilterIcon,
  PlusIcon,
  Rows3Icon,
  SearchIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react";
import { useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { Separator } from "@/components/ui/separator";
import { DateField } from "./date-field";
import {
  FIELD_REGISTRY,
  FILTER_OPERATOR_LABELS,
} from "@/lib/bitable/field-registry";
import type {
  FieldSchema,
  FilterCondition,
  FilterOperator,
  RowHeight,
  SortCondition,
  ViewConfig,
} from "@/lib/bitable/types";
import { cn } from "@/lib/utils";
import { FieldTypeIcon } from "./field-icon";

interface ToolbarProps {
  fields: FieldSchema[];
  viewConfig: ViewConfig;
  search: string;
  selectedCount: number;
  isGridView: boolean;
  onSearchChange: (value: string) => void;
  onAddRecord: () => void;
  onAddField: () => void;
  onBulkDelete: () => void;
  onUpdateViewConfig: (patch: Partial<ViewConfig>) => void;
}

const ROW_HEIGHT_ITEMS: Array<{ value: RowHeight; label: string }> = [
  { value: "compact", label: "紧凑行高" },
  { value: "standard", label: "标准行高" },
  { value: "tall", label: "宽松行高" },
];

export function BitableToolbar({
  fields,
  viewConfig,
  search,
  selectedCount,
  isGridView,
  onSearchChange,
  onAddRecord,
  onAddField,
  onBulkDelete,
  onUpdateViewConfig,
}: ToolbarProps) {
  const [searchExpanded, setSearchExpanded] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const hiddenFieldIds = viewConfig.hiddenFieldIds ?? [];
  const filters = viewConfig.filters ?? [];
  const sorts = viewConfig.sorts ?? [];
  const rowHeight = viewConfig.rowHeight ?? "standard";

  function toggleFieldVisibility(fieldId: string) {
    const next = hiddenFieldIds.includes(fieldId)
      ? hiddenFieldIds.filter((id) => id !== fieldId)
      : [...hiddenFieldIds, fieldId];
    onUpdateViewConfig({ hiddenFieldIds: next });
  }

  function addFilter() {
    const firstField = fields[0];
    if (!firstField) return;
    const defaultOp =
      FIELD_REGISTRY[firstField.type].filterOperators[0] ?? "contains";
    const next: FilterCondition = {
      id: `flt_${Date.now().toString(36)}`,
      fieldId: firstField.id,
      operator: defaultOp,
      value: firstField.type === "boolean" ? true : "",
    };
    onUpdateViewConfig({ filters: [...filters, next] });
  }

  function updateFilter(id: string, patch: Partial<FilterCondition>) {
    onUpdateViewConfig({
      filters: filters.map((item) =>
        item.id === id ? { ...item, ...patch } : item
      ),
    });
  }

  function removeFilter(id: string) {
    onUpdateViewConfig({
      filters: filters.filter((item) => item.id !== id),
    });
  }

  function addSort() {
    const unused = fields.find((f) => !sorts.some((s) => s.fieldId === f.id));
    const target = unused ?? fields[0];
    if (!target) return;
    onUpdateViewConfig({
      sorts: [...sorts, { fieldId: target.id, direction: "asc" }],
    });
  }

  function updateSort(index: number, patch: Partial<SortCondition>) {
    onUpdateViewConfig({
      sorts: sorts.map((item, idx) =>
        idx === index ? { ...item, ...patch } : item
      ),
    });
  }

  function removeSort(index: number) {
    onUpdateViewConfig({
      sorts: sorts.filter((_, idx) => idx !== index),
    });
  }

  const showSearchInput = searchExpanded || search.length > 0;

  return (
    <div className="flex h-12 shrink-0 items-center justify-between gap-2 border-b border-border bg-background px-4">
      <div className="flex items-center gap-1.5">
        <Button variant="outline" size="sm" onClick={onAddRecord}>
          <PlusIcon className="size-4" aria-hidden="true" />
          添加记录
        </Button>

        <Popover>
          <PopoverTrigger
            render={
              <Button
                variant="ghost"
                size="sm"
                className="text-foreground"
              />
            }
          >
            <EyeOffIcon className="size-4" aria-hidden="true" />
            字段配置
            {hiddenFieldIds.length > 0 && (
              <Badge variant="secondary" className="h-4 px-1 text-[10px]">
                隐 {hiddenFieldIds.length}
              </Badge>
            )}
          </PopoverTrigger>
          <PopoverContent align="start" className="w-64 gap-2 p-2">
            <div className="flex h-8 items-center justify-between px-2">
              <PopoverTitle>字段配置</PopoverTitle>
              {hiddenFieldIds.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onUpdateViewConfig({ hiddenFieldIds: [] })}
                  className="h-6 px-1.5 text-xs text-muted-foreground"
                >
                  全部显示
                </Button>
              )}
            </div>
            <div className="flex max-h-64 flex-col gap-0.5 overflow-y-auto">
              {fields.map((field) => {
                const visible = !hiddenFieldIds.includes(field.id);
                return (
                  <label
                    key={field.id}
                    className="flex h-8 items-center gap-2 rounded-sm px-2 text-sm hover:bg-accent cursor-pointer"
                  >
                    <Checkbox
                      checked={visible}
                      disabled={field.isPrimary}
                      onCheckedChange={() => toggleFieldVisibility(field.id)}
                    />
                    <FieldTypeIcon type={field.type} />
                    <span className="bitable-cell-truncate flex-1">
                      {field.name}
                    </span>
                  </label>
                );
              })}
            </div>
            <Separator />
            <Button
              variant="ghost"
              size="sm"
              onClick={onAddField}
              className="h-8 w-full justify-start gap-2 px-2 text-sm text-foreground"
            >
              <PlusIcon className="size-4" aria-hidden="true" />
              新增字段
            </Button>
          </PopoverContent>
        </Popover>

        <Popover>
          <PopoverTrigger
            render={
              <Button
                variant="ghost"
                size="sm"
                className="text-foreground"
              />
            }
          >
            <FilterIcon className="size-4" aria-hidden="true" />
            筛选
            {filters.length > 0 && (
              <Badge variant="secondary" className="h-4 px-1 text-[10px]">
                {filters.length}
              </Badge>
            )}
          </PopoverTrigger>
          <PopoverContent
            align="start"
            className="w-[30rem] max-h-(--available-height) max-w-[92vw] overflow-hidden"
          >
            <div className="flex shrink-0 items-center justify-between">
              <PopoverTitle>筛选条件（同时满足）</PopoverTitle>
              {filters.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onUpdateViewConfig({ filters: [] })}
                  className="h-6 px-1.5 text-xs text-muted-foreground"
                >
                  清空
                </Button>
              )}
            </div>

            {filters.length === 0 ? (
              <p className="text-sm text-muted-foreground">尚未添加筛选条件</p>
            ) : (
              <div className="flex max-h-80 min-h-0 flex-1 flex-col gap-2 overflow-y-auto overscroll-contain">
                {filters.map((flt) => {
                  const targetField =
                    fields.find((f) => f.id === flt.fieldId) ?? fields[0];
                  const ops = targetField
                    ? FIELD_REGISTRY[targetField.type].filterOperators
                    : (["contains"] as FilterOperator[]);
                  const hideValueInput =
                    flt.operator === "isEmpty" || flt.operator === "isNotEmpty";

                  return (
                    <div key={flt.id} className="flex items-center gap-1.5">
                      <Select
                        value={flt.fieldId}
                        onValueChange={(nextFieldId) => {
                          if (!nextFieldId) return;
                          const nf = fields.find((f) => f.id === nextFieldId);
                          const nextOp = nf
                            ? FIELD_REGISTRY[nf.type].filterOperators[0]
                            : "contains";
                          updateFilter(flt.id, {
                            fieldId: nextFieldId,
                            operator: nextOp,
                            value: nf?.type === "boolean" ? true : "",
                          });
                        }}
                      >
                        <SelectTrigger size="sm" className="w-32 shrink-0">
                          <SelectValue>
                            {() => targetField?.name ?? ""}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {fields.map((f) => (
                            <SelectItem key={f.id} value={f.id}>
                              {f.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      <Select
                        value={flt.operator}
                        onValueChange={(nextOp) => {
                          if (nextOp) {
                            updateFilter(flt.id, {
                              operator: nextOp as FilterOperator,
                            });
                          }
                        }}
                      >
                        <SelectTrigger size="sm" className="w-28 shrink-0">
                          <SelectValue>
                            {() => FILTER_OPERATOR_LABELS[flt.operator]}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {ops.map((op) => (
                            <SelectItem key={op} value={op}>
                              {FILTER_OPERATOR_LABELS[op]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      {!hideValueInput && targetField?.type === "boolean" ? (
                        <Select
                          value={String(Boolean(flt.value))}
                          onValueChange={(v) =>
                            updateFilter(flt.id, { value: v === "true" })
                          }
                        >
                          <SelectTrigger size="sm" className="flex-1">
                            <SelectValue>
                              {() => (Boolean(flt.value) ? "是" : "否")}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="true">是</SelectItem>
                            <SelectItem value="false">否</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : !hideValueInput &&
                        (targetField?.type === "singleSelect" ||
                          targetField?.type === "multiSelect") ? (
                        <Select
                          value={flt.value ? String(flt.value) : ""}
                          onValueChange={(v) =>
                            updateFilter(flt.id, { value: v ?? "" })
                          }
                        >
                          <SelectTrigger size="sm" className="flex-1">
                            <SelectValue>
                              {() =>
                                targetField.config.options?.find(
                                  (o) => o.id === String(flt.value ?? "")
                                )?.name ?? (
                                  <span className="text-muted-foreground">
                                    选择选项
                                  </span>
                                )
                              }
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            {(targetField.config.options ?? []).map((opt) => (
                              <SelectItem key={opt.id} value={opt.id}>
                                {opt.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : !hideValueInput &&
                        (targetField?.type === "date" ||
                          targetField?.type === "datetime") ? (
                        <DateField
                          variant="filter"
                          withTime={targetField.type === "datetime"}
                          aria-label="筛选值"
                          value={flt.value}
                          onChange={(next) =>
                            updateFilter(flt.id, { value: next ?? "" })
                          }
                        />
                      ) : !hideValueInput ? (
                        <Input
                          type={targetField?.type === "number" ? "number" : "text"}
                          aria-label="筛选值"
                          value={
                            flt.value === null || flt.value === undefined
                              ? ""
                              : String(flt.value)
                          }
                          onChange={(e) =>
                            updateFilter(flt.id, { value: e.target.value })
                          }
                          placeholder="输入筛选值"
                          className="h-8 min-w-0 flex-1 text-xs"
                        />
                      ) : (
                        <div className="flex-1" />
                      )}

                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label="移除该筛选条件"
                        onClick={() => removeFilter(flt.id)}
                        className="shrink-0 text-foreground"
                      >
                        <XIcon className="size-4" aria-hidden="true" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="flex shrink-0 justify-start">
              <Button variant="outline" size="sm" onClick={addFilter}>
                <PlusIcon className="size-4" aria-hidden="true" />
                添加筛选
              </Button>
            </div>
          </PopoverContent>
        </Popover>

        <Popover>
          <PopoverTrigger
            render={
              <Button
                variant="ghost"
                size="sm"
                className="text-foreground"
              />
            }
          >
            <ArrowUpDownIcon
              className="size-4"
              aria-hidden="true"
            />
            排序
            {sorts.length > 0 && (
              <Badge variant="secondary" className="h-4 px-1 text-[10px]">
                {sorts.length}
              </Badge>
            )}
          </PopoverTrigger>
          <PopoverContent
            align="start"
            className="w-80 max-h-(--available-height) overflow-hidden"
          >
            <div className="flex shrink-0 items-center justify-between">
              <PopoverTitle>排序规则</PopoverTitle>
              {sorts.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onUpdateViewConfig({ sorts: [] })}
                  className="h-6 px-1.5 text-xs text-muted-foreground"
                >
                  清空
                </Button>
              )}
            </div>

            {sorts.length === 0 ? (
              <p className="text-sm text-muted-foreground">按默认记录顺序排列</p>
            ) : (
              <div className="flex max-h-80 min-h-0 flex-1 flex-col gap-2 overflow-y-auto overscroll-contain">
                {sorts.map((sort, idx) => {
                  const targetField = fields.find((f) => f.id === sort.fieldId);
                  return (
                    <div
                      key={`${sort.fieldId}-${idx}`}
                      className="flex items-center gap-1.5"
                    >
                      <Select
                        value={sort.fieldId}
                        onValueChange={(nextFieldId) => {
                          if (nextFieldId) {
                            updateSort(idx, { fieldId: nextFieldId });
                          }
                        }}
                      >
                        <SelectTrigger size="sm" className="flex-1">
                          <SelectValue>
                            {() => targetField?.name ?? ""}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {fields.map((f) => (
                            <SelectItem key={f.id} value={f.id}>
                              {f.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      <Select
                        value={sort.direction}
                        onValueChange={(dir) => {
                          if (dir === "asc" || dir === "desc") {
                            updateSort(idx, { direction: dir });
                          }
                        }}
                      >
                        <SelectTrigger size="sm" className="w-24 shrink-0">
                          <SelectValue>
                            {() => (sort.direction === "asc" ? "升序" : "降序")}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="asc">升序</SelectItem>
                          <SelectItem value="desc">降序</SelectItem>
                        </SelectContent>
                      </Select>

                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label="移除该排序规则"
                        onClick={() => removeSort(idx)}
                        className="shrink-0 text-foreground"
                      >
                        <XIcon className="size-4" aria-hidden="true" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="flex shrink-0 justify-start">
              <Button variant="outline" size="sm" onClick={addSort}>
                <PlusIcon className="size-4" aria-hidden="true" />
                添加排序
              </Button>
            </div>
          </PopoverContent>
        </Popover>

        {isGridView && (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="切换行高"
                  className="text-foreground"
                />
              }
            >
              <Rows3Icon className="size-4" aria-hidden="true" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {ROW_HEIGHT_ITEMS.map((item) => (
                <DropdownMenuItem
                  key={item.value}
                  onClick={() => onUpdateViewConfig({ rowHeight: item.value })}
                >
                  <span className="flex-1">{item.label}</span>
                  {rowHeight === item.value && (
                    <CheckIcon className="size-4" aria-hidden="true" />
                  )}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {selectedCount > 0 && (
          <>
            <Separator orientation="vertical" className="mx-1 h-4" />
            <Button variant="destructive" size="sm" onClick={onBulkDelete}>
              <Trash2Icon className="size-4" aria-hidden="true" />
              删除选中 ({selectedCount})
            </Button>
          </>
        )}
      </div>

      <div className="flex items-center gap-1">
        <div
          className={cn(
            "relative -m-1 flex h-10 items-center justify-end overflow-hidden p-1 motion-safe:transition-[width] motion-safe:duration-200 ease-out",
            showSearchInput ? "w-58" : "w-10"
          )}
        >
          <div
            aria-hidden={!showSearchInput}
            inert={!showSearchInput}
            className={cn(
              "relative w-56 shrink-0 motion-safe:transition-opacity motion-safe:duration-150",
              showSearchInput ? "opacity-100" : "pointer-events-none opacity-0"
            )}
          >
            <SearchIcon
              className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-foreground/70"
              aria-hidden="true"
            />
            <Input
              ref={searchInputRef}
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              onBlur={() => {
                if (!search) setSearchExpanded(false);
              }}
              aria-label="搜索记录"
              placeholder="搜索记录"
              className="h-8 pr-8 pl-8.5 text-sm"
            />
            <button
              type="button"
              aria-label="关闭搜索"
              onClick={() => {
                onSearchChange("");
                setSearchExpanded(false);
              }}
              className="absolute top-1/2 right-2 -translate-y-1/2 text-foreground/70 hover:text-foreground cursor-pointer"
            >
              <XIcon className="size-4" aria-hidden="true" />
            </button>
          </div>

          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="搜索记录"
            aria-expanded={showSearchInput}
            tabIndex={showSearchInput ? -1 : 0}
            onClick={() => {
              setSearchExpanded(true);
              requestAnimationFrame(() => searchInputRef.current?.focus());
            }}
            className={cn(
              "absolute right-1 text-foreground motion-safe:transition-opacity motion-safe:duration-150",
              showSearchInput
                ? "pointer-events-none opacity-0"
                : "opacity-100"
            )}
          >
            <SearchIcon className="size-4" aria-hidden="true" />
          </Button>
        </div>
      </div>
    </div>
  );
}
