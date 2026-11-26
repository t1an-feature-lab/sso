"use client";

import { CalendarIcon } from "lucide-react";
import { useState } from "react";
import { zhCN } from "react-day-picker/locale";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  formatFieldDate,
  parseFieldDate,
  serializeFieldDate,
} from "@/lib/bitable/field-registry";
import { cn } from "@/lib/utils";

const HOURS = Array.from({ length: 24 }, (_, index) => index);
const MINUTES = Array.from({ length: 60 }, (_, index) => index);

export function DateField({
  id,
  value,
  onChange,
  withTime = false,
  variant = "form",
  placeholder,
  "aria-label": ariaLabel,
}: {
  id?: string;
  value: unknown;
  onChange: (next: string | null) => void;
  withTime?: boolean;
  variant?: "form" | "cell" | "filter";
  placeholder?: string;
  "aria-label"?: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = parseFieldDate(value);
  const emptyLabel = placeholder ?? (withTime ? "选择日期时间" : "选择日期");

  function commit(next: Date | null, close: boolean) {
    onChange(next ? serializeFieldDate(next, withTime) : null);
    if (close) setOpen(false);
  }

  function updateTime(hours: number, minutes: number) {
    const base = selected ? new Date(selected) : new Date();
    base.setHours(hours, minutes, 0, 0);
    commit(base, false);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            id={id}
            type="button"
            variant={variant === "cell" ? "ghost" : "outline"}
            aria-label={ariaLabel ?? emptyLabel}
            className={cn(
              "justify-start font-normal",
              variant === "cell" &&
                "h-full w-full rounded-none px-2.5 text-[13px] shadow-none hover:bg-transparent",
              variant === "form" && "w-full",
              variant === "filter" &&
                "h-8 min-w-0 flex-1 shrink px-2.5 text-xs",
              !selected && variant !== "cell" && "text-muted-foreground"
            )}
          />
        }
      >
        {variant !== "cell" && <CalendarIcon aria-hidden="true" />}
        <span className="truncate tabular-nums">
          {selected
            ? formatFieldDate(selected, withTime)
            : variant === "cell"
              ? ""
              : emptyLabel}
        </span>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto gap-0 p-0">
        <Calendar
          mode="single"
          locale={zhCN}
          selected={selected ?? undefined}
          defaultMonth={selected ?? undefined}
          onSelect={(next) => {
            if (!next) {
              commit(null, true);
              return;
            }
            if (withTime && selected) {
              next.setHours(selected.getHours(), selected.getMinutes(), 0, 0);
            }
            commit(next, !withTime);
          }}
        />
        {withTime && (
          <div className="flex items-center gap-2 border-t border-border p-3">
            <Select
              value={String(selected?.getHours() ?? 0)}
              onValueChange={(next) => {
                if (next === null) return;
                updateTime(Number(next), selected?.getMinutes() ?? 0);
              }}
            >
              <SelectTrigger size="sm" className="flex-1" aria-label="小时">
                <SelectValue>
                  {() =>
                    String(selected?.getHours() ?? 0).padStart(2, "0")
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {HOURS.map((hour) => (
                  <SelectItem key={hour} value={String(hour)}>
                    {String(hour).padStart(2, "0")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={String(selected?.getMinutes() ?? 0)}
              onValueChange={(next) => {
                if (next === null) return;
                updateTime(selected?.getHours() ?? 0, Number(next));
              }}
            >
              <SelectTrigger size="sm" className="flex-1" aria-label="分钟">
                <SelectValue>
                  {() =>
                    String(selected?.getMinutes() ?? 0).padStart(2, "0")
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {MINUTES.map((minute) => (
                  <SelectItem key={minute} value={String(minute)}>
                    {String(minute).padStart(2, "0")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <div className="flex items-center justify-between border-t border-border p-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => commit(null, true)}
          >
            清除
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => commit(new Date(), true)}
          >
            今天
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
