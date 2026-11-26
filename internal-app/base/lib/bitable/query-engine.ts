import { formatCellText, isValueEmpty } from "./field-registry";
import type {
  FieldSchema,
  FilterCondition,
  RecordData,
  RelationTargetItem,
  SortCondition,
} from "./types";

function matchesFilter(
  record: RecordData,
  filter: FilterCondition,
  fieldMap: Map<string, FieldSchema>,
  relationTargets: Record<string, RelationTargetItem[]>
): boolean {
  const field = fieldMap.get(filter.fieldId);
  if (!field) return true;

  const rawValue = record.values[field.id];
  const empty = isValueEmpty(rawValue);

  if (filter.operator === "isEmpty") return empty;
  if (filter.operator === "isNotEmpty") return !empty;

  if (field.type === "boolean") {
    const targetBool = filter.value === true || filter.value === "true";
    const actualBool = Boolean(rawValue);
    return filter.operator === "eq" ? actualBool === targetBool : actualBool !== targetBool;
  }

  if (field.type === "number") {
    if (empty) return filter.operator === "neq";
    const actual = Number(rawValue);
    const target = Number(filter.value);
    if (!Number.isFinite(actual) || !Number.isFinite(target)) return false;
    switch (filter.operator) {
      case "eq":
        return actual === target;
      case "neq":
        return actual !== target;
      case "gt":
        return actual > target;
      case "gte":
        return actual >= target;
      case "lt":
        return actual < target;
      case "lte":
        return actual <= target;
      default:
        return true;
    }
  }

  if (field.type === "date" || field.type === "datetime") {
    if (empty) return filter.operator === "neq";
    const actual = String(rawValue);
    const target = String(filter.value ?? "");
    if (!target) return true;
    switch (filter.operator) {
      case "eq":
        return actual.slice(0, target.length) === target;
      case "neq":
        return actual.slice(0, target.length) !== target;
      case "gt":
        return actual > target;
      case "gte":
        return actual >= target;
      case "lt":
        return actual < target;
      case "lte":
        return actual <= target;
      default:
        return true;
    }
  }

  if (field.type === "singleSelect") {
    const actual = rawValue === null || rawValue === undefined ? "" : String(rawValue);
    const target = filter.value === null || filter.value === undefined ? "" : String(filter.value);
    if (filter.operator === "eq") return actual === target;
    if (filter.operator === "neq") return actual !== target;
    return true;
  }

  if (field.type === "multiSelect" || field.type === "relation") {
    const arr = Array.isArray(rawValue) ? rawValue.map(String) : [];
    const target = String(filter.value ?? "");
    if (!target) return true;
    const has = arr.includes(target);
    return filter.operator === "contains" ? has : !has;
  }

  const text = formatCellText(field, rawValue, relationTargets).toLowerCase();
  const needle = String(filter.value ?? "").toLowerCase();
  switch (filter.operator) {
    case "eq":
      return text === needle;
    case "neq":
      return text !== needle;
    case "contains":
      return text.includes(needle);
    case "notContains":
      return !text.includes(needle);
    default:
      return true;
  }
}

function compareValues(
  aVal: unknown,
  bVal: unknown,
  field: FieldSchema,
  relationTargets: Record<string, RelationTargetItem[]>
): number {
  const aEmpty = isValueEmpty(aVal);
  const bEmpty = isValueEmpty(bVal);
  if (aEmpty && bEmpty) return 0;
  if (aEmpty) return 1;
  if (bEmpty) return -1;

  if (field.type === "number") {
    return Number(aVal) - Number(bVal);
  }
  if (field.type === "boolean") {
    return Number(Boolean(aVal)) - Number(Boolean(bVal));
  }
  if (field.type === "date" || field.type === "datetime") {
    return String(aVal).localeCompare(String(bVal));
  }
  const aText = formatCellText(field, aVal, relationTargets);
  const bText = formatCellText(field, bVal, relationTargets);
  return aText.localeCompare(bText, "zh-CN");
}

export function queryRecords(params: {
  records: RecordData[];
  fields: FieldSchema[];
  filters?: FilterCondition[];
  sorts?: SortCondition[];
  search?: string;
  relationTargets?: Record<string, RelationTargetItem[]>;
}): RecordData[] {
  const {
    records,
    fields,
    filters = [],
    sorts = [],
    search = "",
    relationTargets = {},
  } = params;
  const fieldMap = new Map(fields.map((field) => [field.id, field]));
  const needle = search.trim().toLowerCase();

  let result = records.filter((record) => {
    for (const filter of filters) {
      if (!matchesFilter(record, filter, fieldMap, relationTargets)) {
        return false;
      }
    }
    if (needle) {
      const matched = fields.some((field) => {
        const text = formatCellText(field, record.values[field.id], relationTargets);
        return text.toLowerCase().includes(needle);
      });
      if (!matched) return false;
    }
    return true;
  });

  if (sorts.length > 0) {
    result = [...result].sort((a, b) => {
      for (const sort of sorts) {
        const field = fieldMap.get(sort.fieldId);
        if (!field) continue;
        const cmp = compareValues(
          a.values[field.id],
          b.values[field.id],
          field,
          relationTargets
        );
        if (cmp !== 0) {
          return sort.direction === "asc" ? cmp : -cmp;
        }
      }
      return a.sortOrder - b.sortOrder;
    });
  }

  return result;
}
