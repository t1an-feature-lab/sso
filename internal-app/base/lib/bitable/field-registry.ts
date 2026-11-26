import type {
  FieldSchema,
  FieldType,
  FilterOperator,
  RelationTargetItem,
  SelectOptionColor,
} from "./types";

export interface FieldTypeDefinition {
  type: FieldType;
  label: string;
  sqlType: string;
  description: string;
  defaultWidth: number;
  defaultValue: () => unknown;
  filterOperators: FilterOperator[];
}

export const SELECT_COLOR_STYLES: Record<
  SelectOptionColor,
  { bg: string; text: string; border: string; dot: string; label: string }
> = {
  slate: {
    bg: "bg-slate-100 dark:bg-slate-800/80",
    text: "text-slate-700 dark:text-slate-200",
    border: "border-slate-200 dark:border-slate-700",
    dot: "bg-slate-500",
    label: "石板灰",
  },
  blue: {
    bg: "bg-blue-50 dark:bg-blue-950/60",
    text: "text-blue-700 dark:text-blue-200",
    border: "border-blue-200 dark:border-blue-800",
    dot: "bg-blue-500",
    label: "海蓝色",
  },
  emerald: {
    bg: "bg-emerald-50 dark:bg-emerald-950/60",
    text: "text-emerald-700 dark:text-emerald-200",
    border: "border-emerald-200 dark:border-emerald-800",
    dot: "bg-emerald-500",
    label: "翠绿色",
  },
  amber: {
    bg: "bg-amber-50 dark:bg-amber-950/60",
    text: "text-amber-800 dark:text-amber-200",
    border: "border-amber-200 dark:border-amber-800",
    dot: "bg-amber-500",
    label: "琥珀黄",
  },
  rose: {
    bg: "bg-rose-50 dark:bg-rose-950/60",
    text: "text-rose-700 dark:text-rose-200",
    border: "border-rose-200 dark:border-rose-800",
    dot: "bg-rose-500",
    label: "玫红色",
  },
  violet: {
    bg: "bg-violet-50 dark:bg-violet-950/60",
    text: "text-violet-700 dark:text-violet-200",
    border: "border-violet-200 dark:border-violet-800",
    dot: "bg-violet-500",
    label: "紫罗兰",
  },
  cyan: {
    bg: "bg-cyan-50 dark:bg-cyan-950/60",
    text: "text-cyan-800 dark:text-cyan-200",
    border: "border-cyan-200 dark:border-cyan-800",
    dot: "bg-cyan-500",
    label: "青色",
  },
  orange: {
    bg: "bg-orange-50 dark:bg-orange-950/60",
    text: "text-orange-800 dark:text-orange-200",
    border: "border-orange-200 dark:border-orange-800",
    dot: "bg-orange-500",
    label: "橘色",
  },
};

export const SELECT_COLOR_LIST: SelectOptionColor[] = [
  "blue",
  "emerald",
  "amber",
  "rose",
  "violet",
  "cyan",
  "orange",
  "slate",
];

export const BASE_ICON_COLORS = [
  "#2563eb",
  "#059669",
  "#7c3aed",
  "#d97706",
  "#dc2626",
  "#0891b2",
  "#4f46e5",
  "#334155",
];

export const FILTER_OPERATOR_LABELS: Record<FilterOperator, string> = {
  eq: "等于",
  neq: "不等于",
  contains: "包含",
  notContains: "不包含",
  gt: "大于",
  gte: "大于等于",
  lt: "小于",
  lte: "小于等于",
  isEmpty: "为空",
  isNotEmpty: "不为空",
};

export const FIELD_REGISTRY: Record<FieldType, FieldTypeDefinition> = {
  text: {
    type: "text",
    label: "文本",
    sqlType: "TEXT",
    description: "单行或多行字符串",
    defaultWidth: 200,
    defaultValue: () => "",
    filterOperators: ["contains", "notContains", "eq", "neq", "isEmpty", "isNotEmpty"],
  },
  number: {
    type: "number",
    label: "数字",
    sqlType: "NUMERIC",
    description: "整数或小数数值",
    defaultWidth: 150,
    defaultValue: () => null,
    filterOperators: ["eq", "neq", "gt", "gte", "lt", "lte", "isEmpty", "isNotEmpty"],
  },
  boolean: {
    type: "boolean",
    label: "布尔值",
    sqlType: "BOOLEAN",
    description: "是或否勾选状态",
    defaultWidth: 120,
    defaultValue: () => false,
    filterOperators: ["eq", "neq"],
  },
  date: {
    type: "date",
    label: "日期",
    sqlType: "DATE",
    description: "年-月-日日期",
    defaultWidth: 150,
    defaultValue: () => null,
    filterOperators: ["eq", "neq", "gt", "gte", "lt", "lte", "isEmpty", "isNotEmpty"],
  },
  datetime: {
    type: "datetime",
    label: "日期时间",
    sqlType: "TIMESTAMP",
    description: "精确到分钟的时间戳",
    defaultWidth: 185,
    defaultValue: () => null,
    filterOperators: ["eq", "neq", "gt", "gte", "lt", "lte", "isEmpty", "isNotEmpty"],
  },
  singleSelect: {
    type: "singleSelect",
    label: "单选",
    sqlType: "ENUM",
    description: "从预设选项中选一项",
    defaultWidth: 150,
    defaultValue: () => null,
    filterOperators: ["eq", "neq", "isEmpty", "isNotEmpty"],
  },
  multiSelect: {
    type: "multiSelect",
    label: "多选",
    sqlType: "TEXT[]",
    description: "从预设选项中选多项",
    defaultWidth: 210,
    defaultValue: () => [],
    filterOperators: ["contains", "notContains", "isEmpty", "isNotEmpty"],
  },
  url: {
    type: "url",
    label: "链接",
    sqlType: "URL",
    description: "网页或资源地址",
    defaultWidth: 220,
    defaultValue: () => "",
    filterOperators: ["contains", "notContains", "eq", "isEmpty", "isNotEmpty"],
  },
  email: {
    type: "email",
    label: "邮箱",
    sqlType: "EMAIL",
    description: "电子邮箱地址",
    defaultWidth: 210,
    defaultValue: () => "",
    filterOperators: ["contains", "notContains", "eq", "isEmpty", "isNotEmpty"],
  },
  json: {
    type: "json",
    label: "JSON",
    sqlType: "JSONB",
    description: "结构化 JSON 对象或数组",
    defaultWidth: 220,
    defaultValue: () => null,
    filterOperators: ["contains", "isEmpty", "isNotEmpty"],
  },
  relation: {
    type: "relation",
    label: "关联记录",
    sqlType: "FOREIGN KEY",
    description: "关联其他数据表的记录",
    defaultWidth: 220,
    defaultValue: () => [],
    filterOperators: ["contains", "isEmpty", "isNotEmpty"],
  },
};

export const FIELD_TYPE_LIST: FieldTypeDefinition[] = [
  FIELD_REGISTRY.text,
  FIELD_REGISTRY.number,
  FIELD_REGISTRY.boolean,
  FIELD_REGISTRY.singleSelect,
  FIELD_REGISTRY.multiSelect,
  FIELD_REGISTRY.date,
  FIELD_REGISTRY.datetime,
  FIELD_REGISTRY.url,
  FIELD_REGISTRY.email,
  FIELD_REGISTRY.json,
  FIELD_REGISTRY.relation,
];

export function normalizeFieldValue(field: FieldSchema, raw: unknown): unknown {
  if (raw === undefined) {
    return field.config.defaultValue ?? FIELD_REGISTRY[field.type].defaultValue();
  }
  switch (field.type) {
    case "text":
    case "url":
    case "email":
      return raw === null ? "" : String(raw);
    case "number": {
      if (raw === null || raw === "") return null;
      const num = typeof raw === "number" ? raw : Number(raw);
      return Number.isFinite(num) ? num : null;
    }
    case "boolean":
      return Boolean(raw);
    case "date":
    case "datetime":
      if (raw === null || raw === "") return null;
      return String(raw);
    case "singleSelect":
      if (raw === null || raw === "") return null;
      return String(raw);
    case "multiSelect":
      if (Array.isArray(raw)) return raw.map((item) => String(item)).filter(Boolean);
      if (typeof raw === "string" && raw) return [raw];
      return [];
    case "relation":
      if (Array.isArray(raw)) return raw.map((item) => String(item)).filter(Boolean);
      if (typeof raw === "string" && raw) return [raw];
      return [];
    case "json":
      if (raw === null || raw === "") return null;
      if (typeof raw === "string") {
        try {
          return JSON.parse(raw);
        } catch {
          return raw;
        }
      }
      return raw;
    default:
      return raw;
  }
}

const FIELD_DATE_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/;

export function parseFieldDate(value: unknown): Date | null {
  if (value === null || value === undefined || value === "") return null;
  const match = String(value).match(FIELD_DATE_PATTERN);
  if (!match) return null;
  const date = new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
    Number(match[4] ?? "0"),
    Number(match[5] ?? "0"),
    0,
    0
  );
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatFieldDate(date: Date, withTime: boolean): string {
  const dateText = date.toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  if (!withTime) return dateText;
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${dateText} ${hours}:${minutes}`;
}

export function serializeFieldDate(date: Date, withTime: boolean): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  if (!withTime) return `${year}-${month}-${day}`;
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

export function formatCellText(
  field: FieldSchema,
  value: unknown,
  relationTargets?: Record<string, RelationTargetItem[]>
): string {
  if (value === null || value === undefined || value === "") return "";
  switch (field.type) {
    case "boolean":
      return value ? "是" : "否";
    case "number": {
      const num = Number(value);
      if (!Number.isFinite(num)) return "";
      const precision = field.config.precision;
      if (typeof precision === "number") {
        return num.toLocaleString("zh-CN", {
          minimumFractionDigits: precision,
          maximumFractionDigits: precision,
        });
      }
      return num.toLocaleString("zh-CN");
    }
    case "date": {
      const date = parseFieldDate(value);
      return date ? formatFieldDate(date, false) : String(value);
    }
    case "datetime": {
      const date = parseFieldDate(value);
      return date ? formatFieldDate(date, true) : String(value);
    }
    case "singleSelect": {
      const opt = field.config.options?.find((o) => o.id === String(value));
      return opt ? opt.name : String(value);
    }
    case "multiSelect": {
      const ids = Array.isArray(value) ? value.map(String) : [];
      return ids
        .map((id) => field.config.options?.find((o) => o.id === id)?.name ?? id)
        .join(", ");
    }
    case "relation": {
      const ids = Array.isArray(value) ? value.map(String) : [];
      const tableId = field.config.relationTableId;
      const targets = tableId ? relationTargets?.[tableId] ?? [] : [];
      return ids
        .map((id) => targets.find((t) => t.id === id)?.label ?? id.slice(0, 8))
        .join(", ");
    }
    case "json":
      return typeof value === "string" ? value : JSON.stringify(value);
    default:
      return String(value);
  }
}

export function isValueEmpty(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === "string") return value.trim() === "";
  if (Array.isArray(value)) return value.length === 0;
  return false;
}
