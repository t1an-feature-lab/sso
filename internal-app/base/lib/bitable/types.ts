export type FieldType =
  | "text"
  | "number"
  | "boolean"
  | "date"
  | "datetime"
  | "singleSelect"
  | "multiSelect"
  | "url"
  | "email"
  | "json"
  | "relation";

export interface SelectOption {
  id: string;
  name: string;
  color: SelectOptionColor;
}

export type SelectOptionColor =
  | "slate"
  | "blue"
  | "emerald"
  | "amber"
  | "rose"
  | "violet"
  | "cyan"
  | "orange";

export interface FieldConfig {
  options?: SelectOption[];
  precision?: number;
  defaultValue?: unknown;
  relationTableId?: string;
  multiple?: boolean;
}

export interface BaseSchema {
  id: string;
  name: string;
  description: string;
  iconColor: string;
  sortOrder: number;
  tableCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface TableSummary {
  id: string;
  baseId: string;
  name: string;
  description: string;
  sortOrder: number;
  recordCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface FieldSchema {
  id: string;
  tableId: string;
  name: string;
  type: FieldType;
  required: boolean;
  isPrimary: boolean;
  width: number;
  config: FieldConfig;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export type FilterOperator =
  | "eq"
  | "neq"
  | "contains"
  | "notContains"
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "isEmpty"
  | "isNotEmpty";

export interface FilterCondition {
  id: string;
  fieldId: string;
  operator: FilterOperator;
  value?: unknown;
}

export interface SortCondition {
  fieldId: string;
  direction: "asc" | "desc";
}

export type RowHeight = "compact" | "standard" | "tall";

export type ViewType = "grid" | "kanban" | "gallery";

export interface ViewConfig {
  hiddenFieldIds?: string[];
  filters?: FilterCondition[];
  sorts?: SortCondition[];
  groupByFieldId?: string;
  rowHeight?: RowHeight;
  columnWidths?: Record<string, number>;
}

export interface ViewSchema {
  id: string;
  tableId: string;
  name: string;
  type: ViewType;
  config: ViewConfig;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface RecordData {
  id: string;
  tableId: string;
  values: Record<string, unknown>;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface RelationEdge {
  id: string;
  fieldId: string;
  sourceRecordId: string;
  targetRecordId: string;
  sortOrder: number;
}

export interface RelationTargetItem {
  id: string;
  label: string;
}

export interface TableDetailPayload {
  storageMode: "postgres" | "memory";
  bases: BaseSchema[];
  base: BaseSchema;
  tables: TableSummary[];
  table: TableSummary;
  fields: FieldSchema[];
  views: ViewSchema[];
  records: RecordData[];
  totalRecords: number;
  hasMoreRecords: boolean;
  nextRecordOffset: number;
  relationTargets: Record<string, RelationTargetItem[]>;
}

export interface RecordsPagePayload {
  records: RecordData[];
  total: number;
  hasMore: boolean;
  nextOffset: number;
}

export interface BaseDetailPayload {
  storageMode: "postgres" | "memory";
  bases: BaseSchema[];
  base: BaseSchema;
  tables: TableSummary[];
}

export interface BaseWithTables extends BaseSchema {
  tables: TableSummary[];
}

export interface BasesListPayload {
  storageMode: "postgres" | "memory";
  bases: BaseWithTables[];
  total: number;
  hasMore: boolean;
  nextOffset: number;
}
