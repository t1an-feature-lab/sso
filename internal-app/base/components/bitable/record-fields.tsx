"use client";

import { Link2Icon } from "lucide-react";
import { useLayoutEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
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
import { FieldTypeIcon } from "./field-icon";

export function OptionBadge({
  name,
  color,
  className,
}: {
  name: string;
  color: SelectOptionColor;
  className?: string;
}) {
  const style = SELECT_COLOR_STYLES[color] ?? SELECT_COLOR_STYLES.slate;
  return (
    <Badge variant="outline" className={cn("max-w-full min-w-0", className)}>
      <span
        className={cn("size-1.5 shrink-0 rounded-full", style.dot)}
        aria-hidden="true"
      />
      <span className="truncate">{name}</span>
    </Badge>
  );
}

export function OptionTagGroup({ options }: { options: SelectOption[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const [visibleCount, setVisibleCount] = useState(options.length);
  const signature = options
    .map((option) => `${option.id}:${option.name}:${option.color}`)
    .join("|");

  useLayoutEffect(() => {
    const container = containerRef.current;
    const measure = measureRef.current;
    if (!container || !measure) return;

    const compute = () => {
      const available = container.clientWidth;
      const tags = [...measure.querySelectorAll<HTMLElement>("[data-tag]")];
      const overflow = measure.querySelector<HTMLElement>("[data-overflow]");
      if (tags.length === 0) {
        setVisibleCount(0);
        return;
      }
      if (available <= 0) {
        setVisibleCount(tags.length);
        return;
      }
      const gap = Number.parseFloat(getComputedStyle(measure).columnGap) || 0;
      const overflowWidth = overflow?.offsetWidth ?? 0;
      let count = tags.length;
      while (count > 0) {
        let width = 0;
        for (let index = 0; index < count; index += 1) {
          width += tags[index].offsetWidth;
          if (index > 0) width += gap;
        }
        const hidden = tags.length - count;
        if (hidden > 0) width += gap + overflowWidth;
        if (width <= available + 0.5) break;
        count -= 1;
      }
      if (count === 0 && tags.length === 1) count = 1;
      setVisibleCount((current) => (current === count ? current : count));
    };

    compute();
    const observer = new ResizeObserver(compute);
    observer.observe(container);
    return () => observer.disconnect();
  }, [signature]);

  if (options.length === 0) return null;

  const count = Math.min(visibleCount, options.length);
  const hidden = options.length - count;

  return (
    <div
      ref={containerRef}
      className="relative flex w-full min-w-0 items-center gap-1 overflow-hidden"
    >
      <div
        ref={measureRef}
        aria-hidden="true"
        className="pointer-events-none absolute top-0 left-0 flex w-max items-center gap-1 opacity-0"
      >
        {options.map((option) => (
          <span key={option.id} data-tag className="inline-flex">
            <OptionBadge
              name={option.name}
              color={option.color}
              className="max-w-none"
            />
          </span>
        ))}
        <Badge
          data-overflow
          variant="secondary"
          className="tabular-nums"
        >
          +{options.length}
        </Badge>
      </div>
      {options.slice(0, count).map((option) => (
        <OptionBadge
          key={option.id}
          name={option.name}
          color={option.color}
          className={
            options.length === 1 ? "min-w-0 shrink" : "max-w-none shrink-0"
          }
        />
      ))}
      {hidden > 0 && (
        <Badge
          variant="secondary"
          className="shrink-0 tabular-nums"
          aria-label={`还有 ${hidden} 个标签`}
        >
          +{hidden}
        </Badge>
      )}
    </div>
  );
}

function EmptyValue() {
  return <span className="text-sm text-muted-foreground">—</span>;
}

function FieldValue({
  field,
  value,
  relationTargets,
}: {
  field: FieldSchema;
  value: unknown;
  relationTargets: Record<string, RelationTargetItem[]>;
}) {
  if (field.type === "boolean") {
    if (isValueEmpty(value)) return <EmptyValue />;
    return <span className="text-sm">{value ? "是" : "否"}</span>;
  }

  if (isValueEmpty(value)) return <EmptyValue />;

  if (field.type === "singleSelect") {
    const option = field.config.options?.find((item) => item.id === String(value));
    if (!option) {
      return <span className="truncate text-sm">{formatCellText(field, value)}</span>;
    }
    return <OptionBadge name={option.name} color={option.color} />;
  }

  if (field.type === "multiSelect") {
    const ids = Array.isArray(value) ? value.map(String) : [];
    const options = ids
      .map((id) => field.config.options?.find((item) => item.id === id))
      .filter((item): item is SelectOption => Boolean(item));
    if (options.length === 0) return <EmptyValue />;
    return <OptionTagGroup options={options} />;
  }

  if (field.type === "relation") {
    const ids = Array.isArray(value) ? value.map(String) : [];
    const targets = field.config.relationTableId
      ? relationTargets[field.config.relationTableId] ?? []
      : [];
    if (ids.length === 0) return <EmptyValue />;
    return (
      <>
        {ids.map((id) => {
          const item = targets.find((target) => target.id === id);
          return (
            <Badge key={id} variant="secondary" className="max-w-full min-w-0">
              <Link2Icon aria-hidden="true" />
              <span className="truncate">{item?.label ?? id.slice(0, 8)}</span>
            </Badge>
          );
        })}
      </>
    );
  }

  if (field.type === "url") {
    const text = formatCellText(field, value, relationTargets);
    if (!text) return <EmptyValue />;
    const href = /^https?:\/\//i.test(text) ? text : `https://${text}`;
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        className="min-w-0 truncate text-sm text-blue-600 underline underline-offset-4 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
      >
        {text}
      </a>
    );
  }

  const text = formatCellText(field, value, relationTargets);
  if (!text) return <EmptyValue />;

  return (
    <span
      className={cn(
        "min-w-0 truncate text-sm",
        field.type === "number" && "tabular-nums",
        field.type === "json" && "font-mono text-muted-foreground"
      )}
    >
      {text}
    </span>
  );
}

export function RecordFieldList({
  fields,
  record,
  relationTargets,
}: {
  fields: FieldSchema[];
  record: RecordData;
  relationTargets: Record<string, RelationTargetItem[]>;
}) {
  return (
    <div className="flex flex-col gap-3">
      {fields.map((field) => (
        <div
          key={field.id}
          className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-3"
        >
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <FieldTypeIcon
              type={field.type}
              className="size-4 shrink-0 text-muted-foreground"
            />
            <span className="max-w-40 truncate text-sm">{field.name}</span>
          </div>
          <div className="flex min-w-0 flex-wrap justify-end gap-1">
            <FieldValue
              field={field}
              value={record.values[field.id]}
              relationTargets={relationTargets}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
