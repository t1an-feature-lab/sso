import crypto from "crypto";
import { FIELD_REGISTRY, formatCellText, normalizeFieldValue } from "@/lib/bitable/field-registry";
import type {
  BaseDetailPayload,
  BaseSchema,
  BasesListPayload,
  FieldConfig,
  FieldSchema,
  FieldType,
  RecordData,
  RelationTargetItem,
  TableDetailPayload,
  TableSummary,
  ViewConfig,
  ViewSchema,
  ViewType,
} from "@/lib/bitable/types";
import { ensureStorage } from "./db";

function makeId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
}

function toIso(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  return String(value ?? new Date().toISOString());
}

export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function buildDefaultFieldsAndView(tableId: string, now: string): {
  fields: FieldSchema[];
  view: ViewSchema;
} {
  const fields: FieldSchema[] = [
    {
      id: makeId("fld"),
      tableId,
      name: "名称",
      type: "text",
      required: true,
      isPrimary: true,
      width: 220,
      config: {},
      sortOrder: 0,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: makeId("fld"),
      tableId,
      name: "状态",
      type: "singleSelect",
      required: false,
      isPrimary: false,
      width: 140,
      config: {
        options: [
          { id: makeId("opt"), name: "待处理", color: "slate" },
          { id: makeId("opt"), name: "进行中", color: "blue" },
          { id: makeId("opt"), name: "已完成", color: "emerald" },
        ],
      },
      sortOrder: 1,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: makeId("fld"),
      tableId,
      name: "数值",
      type: "number",
      required: false,
      isPrimary: false,
      width: 130,
      config: {},
      sortOrder: 2,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: makeId("fld"),
      tableId,
      name: "日期",
      type: "date",
      required: false,
      isPrimary: false,
      width: 150,
      config: {},
      sortOrder: 3,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: makeId("fld"),
      tableId,
      name: "启用",
      type: "boolean",
      required: false,
      isPrimary: false,
      width: 95,
      config: {},
      sortOrder: 4,
      createdAt: now,
      updatedAt: now,
    },
  ];

  const view: ViewSchema = {
    id: makeId("view"),
    tableId,
    name: "表格视图",
    type: "grid",
    config: { rowHeight: "standard" },
    sortOrder: 0,
    createdAt: now,
    updatedAt: now,
  };

  return { fields, view };
}

export async function listBases(options?: {
  limit?: number;
  offset?: number;
  search?: string;
}): Promise<BasesListPayload> {
  const limit = Math.max(1, Math.min(200, Math.floor(options?.limit ?? 20)));
  const offset = Math.max(0, Math.floor(options?.offset ?? 0));
  const search = (options?.search ?? "").trim().toLowerCase();

  const { mode, pool, memory } = await ensureStorage();
  if (mode === "memory" || !pool) {
    const allBases = memory.bases
      .map((base) => {
        const tables = memory.tables
          .filter((t) => t.baseId === base.id)
          .map((t) => ({
            ...t,
            recordCount: memory.records.filter((r) => r.tableId === t.id).length,
          }))
          .sort((a, b) => a.sortOrder - b.sortOrder);
        return {
          ...base,
          tableCount: tables.length,
          tables,
        };
      })
      .filter((base) => {
        if (!search) return true;
        return (
          base.name.toLowerCase().includes(search) ||
          base.description.toLowerCase().includes(search) ||
          base.tables.some((t) => t.name.toLowerCase().includes(search))
        );
      })
      .sort(
        (a, b) =>
          a.sortOrder - b.sortOrder || b.updatedAt.localeCompare(a.updatedAt)
      );

    const total = allBases.length;
    const paged = allBases.slice(offset, offset + limit);
    return {
      storageMode: "memory",
      bases: paged,
      total,
      hasMore: offset + paged.length < total,
      nextOffset: offset + paged.length,
    };
  }

  const whereClause = search
    ? `WHERE LOWER(b.name) LIKE $1
          OR LOWER(b.description) LIKE $1
          OR EXISTS (
            SELECT 1 FROM bitable_tables t2
            WHERE t2.base_id = b.id AND LOWER(t2.name) LIKE $1
          )`
    : "";
  const countParams = search ? [`%${search}%`] : [];
  const pageParams = search ? [`%${search}%`, limit, offset] : [limit, offset];
  const limitPlaceholder = search ? "$2" : "$1";
  const offsetPlaceholder = search ? "$3" : "$2";

  const [countRes, basesRes] = await Promise.all([
    pool.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM bitable_bases b ${whereClause}`,
      countParams
    ),
    pool.query<{
      id: string;
      name: string;
      description: string;
      icon_color: string;
      sort_order: number;
      created_at: Date;
      updated_at: Date;
    }>(
      `SELECT b.id, b.name, b.description, b.icon_color, b.sort_order, b.created_at, b.updated_at
       FROM bitable_bases b
       ${whereClause}
       ORDER BY b.sort_order ASC, b.updated_at DESC
       LIMIT ${limitPlaceholder} OFFSET ${offsetPlaceholder}`,
      pageParams
    ),
  ]);

  const total = Number(countRes.rows[0]?.count ?? 0);
  const baseIds = basesRes.rows.map((r) => r.id);

  const tablesByBase = new Map<string, TableSummary[]>();
  if (baseIds.length > 0) {
    const tablesRes = await pool.query<{
      id: string;
      base_id: string;
      name: string;
      description: string;
      sort_order: number;
      record_count: string;
      created_at: Date;
      updated_at: Date;
    }>(
      `SELECT t.id, t.base_id, t.name, t.description, t.sort_order,
              COUNT(r.id)::text AS record_count,
              t.created_at, t.updated_at
       FROM bitable_tables t
       LEFT JOIN bitable_records r ON r.table_id = t.id
       WHERE t.base_id = ANY($1::text[])
       GROUP BY t.id
       ORDER BY t.sort_order ASC, t.created_at ASC`,
      [baseIds]
    );

    for (const row of tablesRes.rows) {
      const list = tablesByBase.get(row.base_id) ?? [];
      list.push({
        id: row.id,
        baseId: row.base_id,
        name: row.name,
        description: row.description,
        sortOrder: row.sort_order,
        recordCount: Number(row.record_count),
        createdAt: toIso(row.created_at),
        updatedAt: toIso(row.updated_at),
      });
      tablesByBase.set(row.base_id, list);
    }
  }

  const bases = basesRes.rows.map((row) => {
    const tables = tablesByBase.get(row.id) ?? [];
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      iconColor: row.icon_color,
      sortOrder: row.sort_order,
      tableCount: tables.length,
      tables,
      createdAt: toIso(row.created_at),
      updatedAt: toIso(row.updated_at),
    };
  });

  return {
    storageMode: "postgres",
    bases,
    total,
    hasMore: offset + bases.length < total,
    nextOffset: offset + bases.length,
  };
}

export async function getBaseDetail(baseId: string): Promise<BaseDetailPayload> {
  const { mode, pool, memory } = await ensureStorage();
  const { bases } = await listBases({ limit: 200, offset: 0 });
  if (mode === "memory" || !pool) {
    const base = memory.bases.find((b) => b.id === baseId);
    if (!base) throw new HttpError(404, "数据库不存在");
    const tables = memory.tables
      .filter((t) => t.baseId === baseId)
      .map((t) => ({
        ...t,
        recordCount: memory.records.filter((r) => r.tableId === t.id).length,
      }))
      .sort((a, b) => a.sortOrder - b.sortOrder);
    return {
      storageMode: "memory",
      bases,
      base: { ...base, tableCount: tables.length },
      tables,
    };
  }

  const baseRes = await pool.query<{
    id: string;
    name: string;
    description: string;
    icon_color: string;
    sort_order: number;
    created_at: Date;
    updated_at: Date;
  }>("SELECT * FROM bitable_bases WHERE id = $1", [baseId]);

  const baseRow = baseRes.rows[0];
  if (!baseRow) throw new HttpError(404, "数据库不存在");

  const tablesRes = await pool.query<{
    id: string;
    base_id: string;
    name: string;
    description: string;
    sort_order: number;
    record_count: string;
    created_at: Date;
    updated_at: Date;
  }>(
    `SELECT t.*, COUNT(r.id)::text AS record_count
     FROM bitable_tables t
     LEFT JOIN bitable_records r ON r.table_id = t.id
     WHERE t.base_id = $1
     GROUP BY t.id
     ORDER BY t.sort_order ASC, t.created_at ASC`,
    [baseId]
  );

  const tables: TableSummary[] = tablesRes.rows.map((row) => ({
    id: row.id,
    baseId: row.base_id,
    name: row.name,
    description: row.description,
    sortOrder: row.sort_order,
    recordCount: Number(row.record_count),
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  }));

  return {
    storageMode: "postgres",
    bases,
    base: {
      id: baseRow.id,
      name: baseRow.name,
      description: baseRow.description,
      iconColor: baseRow.icon_color,
      sortOrder: baseRow.sort_order,
      tableCount: tables.length,
      createdAt: toIso(baseRow.created_at),
      updatedAt: toIso(baseRow.updated_at),
    },
    tables,
  };
}

export async function createBase(input: {
  name: string;
  description?: string;
  iconColor?: string;
}): Promise<{ base: BaseSchema; defaultTableId: string }> {
  const name = input.name.trim();
  if (!name) throw new HttpError(400, "请输入数据库名称");

  const now = new Date().toISOString();
  const baseId = makeId("base");
  const tableId = makeId("tbl");
  const description = (input.description ?? "").trim();
  const iconColor = input.iconColor ?? "#2563eb";
  const { fields, view } = buildDefaultFieldsAndView(tableId, now);

  const { mode, pool, memory } = await ensureStorage();
  if (mode === "memory" || !pool) {
    const sortOrder =
      memory.bases.length > 0
        ? Math.min(...memory.bases.map((b) => b.sortOrder)) - 1
        : 0;
    const base: BaseSchema = {
      id: baseId,
      name,
      description,
      iconColor,
      sortOrder,
      tableCount: 1,
      createdAt: now,
      updatedAt: now,
    };
    memory.bases.unshift(base);
    memory.tables.push({
      id: tableId,
      baseId,
      name: "数据表 1",
      description: "",
      sortOrder: 0,
      recordCount: 0,
      createdAt: now,
      updatedAt: now,
    });
    memory.fields.push(...fields);
    memory.views.push(view);
    return { base, defaultTableId: tableId };
  }

  const orderRes = await pool.query<{ next_order: number }>(
    "SELECT COALESCE(MIN(sort_order), 1) - 1 AS next_order FROM bitable_bases"
  );
  const sortOrder = orderRes.rows[0]?.next_order ?? 0;
  const base: BaseSchema = {
    id: baseId,
    name,
    description,
    iconColor,
    sortOrder,
    tableCount: 1,
    createdAt: now,
    updatedAt: now,
  };

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `INSERT INTO bitable_bases (id, name, description, icon_color, sort_order, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [baseId, name, description, iconColor, sortOrder, now, now]
    );
    await client.query(
      `INSERT INTO bitable_tables (id, base_id, name, description, sort_order, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [tableId, baseId, "数据表 1", "", 0, now, now]
    );
    for (const field of fields) {
      await client.query(
        `INSERT INTO bitable_fields (id, table_id, name, type, required, is_primary, width, config, sort_order, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10, $11)`,
        [
          field.id,
          tableId,
          field.name,
          field.type,
          field.required,
          field.isPrimary,
          field.width,
          JSON.stringify(field.config),
          field.sortOrder,
          now,
          now,
        ]
      );
    }
    await client.query(
      `INSERT INTO bitable_views (id, table_id, name, type, config, sort_order, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8)`,
      [view.id, tableId, view.name, view.type, JSON.stringify(view.config), 0, now, now]
    );
    await client.query("COMMIT");
    return { base, defaultTableId: tableId };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function updateBase(
  baseId: string,
  input: { name?: string; description?: string; iconColor?: string }
): Promise<BaseSchema> {
  const now = new Date().toISOString();
  const { mode, pool, memory } = await ensureStorage();
  if (mode === "memory" || !pool) {
    const base = memory.bases.find((b) => b.id === baseId);
    if (!base) throw new HttpError(404, "数据库不存在");
    if (input.name !== undefined) {
      const trimmed = input.name.trim();
      if (!trimmed) throw new HttpError(400, "请输入数据库名称");
      base.name = trimmed;
    }
    if (input.description !== undefined) base.description = input.description.trim();
    if (input.iconColor !== undefined) base.iconColor = input.iconColor;
    base.updatedAt = now;
    return {
      ...base,
      tableCount: memory.tables.filter((t) => t.baseId === baseId).length,
    };
  }

  const current = await getBaseDetail(baseId);
  const nextName = input.name !== undefined ? input.name.trim() : current.base.name;
  if (!nextName) throw new HttpError(400, "请输入数据库名称");
  const nextDesc =
    input.description !== undefined ? input.description.trim() : current.base.description;
  const nextColor = input.iconColor ?? current.base.iconColor;

  await pool.query(
    `UPDATE bitable_bases
     SET name = $2, description = $3, icon_color = $4, updated_at = $5
     WHERE id = $1`,
    [baseId, nextName, nextDesc, nextColor, now]
  );

  return {
    ...current.base,
    name: nextName,
    description: nextDesc,
    iconColor: nextColor,
    updatedAt: now,
  };
}

export async function deleteBase(baseId: string): Promise<void> {
  const { mode, pool, memory } = await ensureStorage();
  if (mode === "memory" || !pool) {
    const idx = memory.bases.findIndex((b) => b.id === baseId);
    if (idx === -1) throw new HttpError(404, "数据库不存在");
    memory.bases.splice(idx, 1);
    const removedTableIds = new Set(
      memory.tables.filter((t) => t.baseId === baseId).map((t) => t.id)
    );
    memory.tables = memory.tables.filter((t) => t.baseId !== baseId);
    const removedFieldIds = new Set(
      memory.fields.filter((f) => removedTableIds.has(f.tableId)).map((f) => f.id)
    );
    memory.fields = memory.fields.filter((f) => !removedTableIds.has(f.tableId));
    memory.views = memory.views.filter((v) => !removedTableIds.has(v.tableId));
    const removedRecordIds = new Set(
      memory.records.filter((r) => removedTableIds.has(r.tableId)).map((r) => r.id)
    );
    memory.records = memory.records.filter((r) => !removedTableIds.has(r.tableId));
    memory.relationEdges = memory.relationEdges.filter(
      (e) =>
        !removedFieldIds.has(e.fieldId) &&
        !removedRecordIds.has(e.sourceRecordId) &&
        !removedRecordIds.has(e.targetRecordId)
    );
    return;
  }

  const res = await pool.query("DELETE FROM bitable_bases WHERE id = $1", [baseId]);
  if (res.rowCount === 0) throw new HttpError(404, "数据库不存在");
}

export async function createTable(
  baseId: string,
  input: { name: string; description?: string }
): Promise<TableSummary> {
  const name = input.name.trim();
  if (!name) throw new HttpError(400, "请输入数据表名称");
  const description = (input.description ?? "").trim();
  const now = new Date().toISOString();
  const tableId = makeId("tbl");
  const { fields, view } = buildDefaultFieldsAndView(tableId, now);

  const { mode, pool, memory } = await ensureStorage();
  if (mode === "memory" || !pool) {
    const base = memory.bases.find((b) => b.id === baseId);
    if (!base) throw new HttpError(404, "数据库不存在");
    const siblings = memory.tables.filter((t) => t.baseId === baseId);
    const sortOrder =
      siblings.length > 0 ? Math.max(...siblings.map((t) => t.sortOrder)) + 1 : 0;
    const table: TableSummary = {
      id: tableId,
      baseId,
      name,
      description,
      sortOrder,
      recordCount: 0,
      createdAt: now,
      updatedAt: now,
    };
    memory.tables.push(table);
    memory.fields.push(...fields);
    memory.views.push(view);
    base.updatedAt = now;
    return table;
  }

  const baseCheck = await pool.query("SELECT id FROM bitable_bases WHERE id = $1", [baseId]);
  if (baseCheck.rowCount === 0) throw new HttpError(404, "数据库不存在");

  const orderRes = await pool.query<{ next_order: number }>(
    "SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_order FROM bitable_tables WHERE base_id = $1",
    [baseId]
  );
  const sortOrder = orderRes.rows[0]?.next_order ?? 0;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `INSERT INTO bitable_tables (id, base_id, name, description, sort_order, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [tableId, baseId, name, description, sortOrder, now, now]
    );
    for (const field of fields) {
      await client.query(
        `INSERT INTO bitable_fields (id, table_id, name, type, required, is_primary, width, config, sort_order, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10, $11)`,
        [
          field.id,
          tableId,
          field.name,
          field.type,
          field.required,
          field.isPrimary,
          field.width,
          JSON.stringify(field.config),
          field.sortOrder,
          now,
          now,
        ]
      );
    }
    await client.query(
      `INSERT INTO bitable_views (id, table_id, name, type, config, sort_order, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8)`,
      [view.id, tableId, view.name, view.type, JSON.stringify(view.config), 0, now, now]
    );
    await client.query("UPDATE bitable_bases SET updated_at = $2 WHERE id = $1", [baseId, now]);
    await client.query("COMMIT");
    return {
      id: tableId,
      baseId,
      name,
      description,
      sortOrder,
      recordCount: 0,
      createdAt: now,
      updatedAt: now,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function getTableDetail(
  tableId: string,
  options?: { recordLimit?: number }
): Promise<TableDetailPayload> {
  const recordLimit = Math.max(
    1,
    Math.min(500, Math.floor(options?.recordLimit ?? 50))
  );
  const { mode, pool, memory } = await ensureStorage();
  if (mode === "memory" || !pool) {
    const table = memory.tables.find((t) => t.id === tableId);
    if (!table) throw new HttpError(404, "数据表不存在");
    const base = memory.bases.find((b) => b.id === table.baseId);
    if (!base) throw new HttpError(404, "数据库不存在");

    const tables = memory.tables
      .filter((t) => t.baseId === base.id)
      .map((t) => ({
        ...t,
        recordCount: memory.records.filter((r) => r.tableId === t.id).length,
      }))
      .sort((a, b) => a.sortOrder - b.sortOrder);

    const fields = memory.fields
      .filter((f) => f.tableId === tableId)
      .sort((a, b) => a.sortOrder - b.sortOrder);
    const views = memory.views
      .filter((v) => v.tableId === tableId)
      .sort((a, b) => a.sortOrder - b.sortOrder);

    const relationFields = fields.filter((f) => f.type === "relation");
    const allRecords = memory.records
      .filter((r) => r.tableId === tableId)
      .sort((a, b) => a.sortOrder - b.sortOrder);
    const totalRecords = allRecords.length;
    const records = allRecords.slice(0, recordLimit).map((record) => {
      const nextValues = { ...record.values };
      for (const field of relationFields) {
        nextValues[field.id] = memory.relationEdges
          .filter((e) => e.fieldId === field.id && e.sourceRecordId === record.id)
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map((e) => e.targetRecordId);
      }
      return { ...record, values: nextValues };
    });

    const relationTargets: Record<string, RelationTargetItem[]> = {};
    const targetTableIds = new Set(
      relationFields
        .map((f) => f.config.relationTableId)
        .filter((id): id is string => Boolean(id))
    );
    for (const targetTableId of targetTableIds) {
      const targetFields = memory.fields
        .filter((f) => f.tableId === targetTableId)
        .sort((a, b) => a.sortOrder - b.sortOrder);
      const primaryField = targetFields.find((f) => f.isPrimary) ?? targetFields[0];
      relationTargets[targetTableId] = memory.records
        .filter((r) => r.tableId === targetTableId)
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((r) => ({
          id: r.id,
          label:
            (primaryField && formatCellText(primaryField, r.values[primaryField.id])) ||
            `未命名记录 (${r.id.slice(-4)})`,
        }));
    }

    const currentTableSummary =
      tables.find((t) => t.id === tableId) ?? { ...table, recordCount: totalRecords };
    const { bases } = await listBases({ limit: 200, offset: 0 });

    return {
      storageMode: "memory",
      bases,
      base: { ...base, tableCount: tables.length },
      tables,
      table: currentTableSummary,
      fields,
      views,
      records,
      totalRecords,
      hasMoreRecords: records.length < totalRecords,
      nextRecordOffset: records.length,
      relationTargets,
    };
  }

  const tableRes = await pool.query<{
    id: string;
    base_id: string;
    name: string;
    description: string;
    sort_order: number;
    created_at: Date;
    updated_at: Date;
  }>("SELECT * FROM bitable_tables WHERE id = $1", [tableId]);
  const tableRow = tableRes.rows[0];
  if (!tableRow) throw new HttpError(404, "数据表不存在");

  const baseDetail = await getBaseDetail(tableRow.base_id);

  const [fieldsRes, viewsRes, totalRes, recordsRes] = await Promise.all([
    pool.query<{
      id: string;
      table_id: string;
      name: string;
      type: FieldType;
      required: boolean;
      is_primary: boolean;
      width: number;
      config: FieldConfig;
      sort_order: number;
      created_at: Date;
      updated_at: Date;
    }>("SELECT * FROM bitable_fields WHERE table_id = $1 ORDER BY sort_order ASC, created_at ASC", [
      tableId,
    ]),
    pool.query<{
      id: string;
      table_id: string;
      name: string;
      type: ViewType;
      config: ViewConfig;
      sort_order: number;
      created_at: Date;
      updated_at: Date;
    }>("SELECT * FROM bitable_views WHERE table_id = $1 ORDER BY sort_order ASC, created_at ASC", [
      tableId,
    ]),
    pool.query<{ count: string }>(
      "SELECT COUNT(*)::text AS count FROM bitable_records WHERE table_id = $1",
      [tableId]
    ),
    pool.query<{
      id: string;
      table_id: string;
      values: Record<string, unknown>;
      sort_order: number;
      created_at: Date;
      updated_at: Date;
    }>(
      "SELECT * FROM bitable_records WHERE table_id = $1 ORDER BY sort_order ASC, created_at ASC LIMIT $2 OFFSET 0",
      [tableId, recordLimit]
    ),
  ]);

  const totalRecords = Number(totalRes.rows[0]?.count ?? 0);
  const recordIds = recordsRes.rows.map((r) => r.id);
  const edgesRes =
    recordIds.length > 0
      ? await pool.query<{
          field_id: string;
          source_record_id: string;
          target_record_id: string;
          sort_order: number;
        }>(
          `SELECT e.field_id, e.source_record_id, e.target_record_id, e.sort_order
           FROM bitable_relation_edges e
           INNER JOIN bitable_fields f ON f.id = e.field_id
           WHERE f.table_id = $1 AND e.source_record_id = ANY($2::text[])
           ORDER BY e.sort_order ASC`,
          [tableId, recordIds]
        )
      : { rows: [] };

  const fields: FieldSchema[] = fieldsRes.rows.map((row) => ({
    id: row.id,
    tableId: row.table_id,
    name: row.name,
    type: row.type,
    required: row.required,
    isPrimary: row.is_primary,
    width: row.width,
    config: row.config ?? {},
    sortOrder: row.sort_order,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  }));

  const views: ViewSchema[] = viewsRes.rows.map((row) => ({
    id: row.id,
    tableId: row.table_id,
    name: row.name,
    type: row.type,
    config: row.config ?? {},
    sortOrder: row.sort_order,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  }));

  const relationFieldIds = new Set(fields.filter((f) => f.type === "relation").map((f) => f.id));
  const edgeMap = new Map<string, string[]>();
  for (const edge of edgesRes.rows) {
    const key = `${edge.source_record_id}:${edge.field_id}`;
    const list = edgeMap.get(key) ?? [];
    list.push(edge.target_record_id);
    edgeMap.set(key, list);
  }

  const records: RecordData[] = recordsRes.rows.map((row) => {
    const values = { ...(row.values ?? {}) };
    for (const fieldId of relationFieldIds) {
      values[fieldId] = edgeMap.get(`${row.id}:${fieldId}`) ?? [];
    }
    return {
      id: row.id,
      tableId: row.table_id,
      values,
      sortOrder: row.sort_order,
      createdAt: toIso(row.created_at),
      updatedAt: toIso(row.updated_at),
    };
  });

  const relationTargets: Record<string, RelationTargetItem[]> = {};
  const targetTableIds = Array.from(
    new Set(
      fields
        .filter((f) => f.type === "relation" && f.config.relationTableId)
        .map((f) => f.config.relationTableId!)
    )
  );

  for (const targetTableId of targetTableIds) {
    const [tFieldsRes, tRecordsRes] = await Promise.all([
      pool.query<{
        id: string;
        table_id: string;
        name: string;
        type: FieldType;
        required: boolean;
        is_primary: boolean;
        width: number;
        config: FieldConfig;
        sort_order: number;
        created_at: Date;
        updated_at: Date;
      }>(
        "SELECT * FROM bitable_fields WHERE table_id = $1 ORDER BY is_primary DESC, sort_order ASC LIMIT 1",
        [targetTableId]
      ),
      pool.query<{ id: string; values: Record<string, unknown> }>(
        "SELECT id, values FROM bitable_records WHERE table_id = $1 ORDER BY sort_order ASC, created_at ASC",
        [targetTableId]
      ),
    ]);
    const pf = tFieldsRes.rows[0];
    const primaryField: FieldSchema | undefined = pf
      ? {
          id: pf.id,
          tableId: pf.table_id,
          name: pf.name,
          type: pf.type,
          required: pf.required,
          isPrimary: pf.is_primary,
          width: pf.width,
          config: pf.config ?? {},
          sortOrder: pf.sort_order,
          createdAt: toIso(pf.created_at),
          updatedAt: toIso(pf.updated_at),
        }
      : undefined;

    relationTargets[targetTableId] = tRecordsRes.rows.map((r) => ({
      id: r.id,
      label:
        (primaryField && formatCellText(primaryField, r.values?.[primaryField.id])) ||
        `未命名记录 (${r.id.slice(-4)})`,
    }));
  }

  const currentTableSummary =
    baseDetail.tables.find((t) => t.id === tableId) ?? {
      id: tableRow.id,
      baseId: tableRow.base_id,
      name: tableRow.name,
      description: tableRow.description,
      sortOrder: tableRow.sort_order,
      recordCount: records.length,
      createdAt: toIso(tableRow.created_at),
      updatedAt: toIso(tableRow.updated_at),
    };

  return {
    storageMode: "postgres",
    bases: baseDetail.bases,
    base: baseDetail.base,
    tables: baseDetail.tables,
    table: currentTableSummary,
    fields,
    views,
    records,
    totalRecords,
    hasMoreRecords: records.length < totalRecords,
    nextRecordOffset: records.length,
    relationTargets,
  };
}

export { listTableRecordsPage as listTableRecords } from "./records-query";
export { reorderBases, reorderRecords, reorderTables, reorderViews } from "./reorder";

export async function updateTable(
  tableId: string,
  input: { name?: string; description?: string }
): Promise<TableSummary> {
  const now = new Date().toISOString();
  const { mode, pool, memory } = await ensureStorage();
  if (mode === "memory" || !pool) {
    const table = memory.tables.find((t) => t.id === tableId);
    if (!table) throw new HttpError(404, "数据表不存在");
    if (input.name !== undefined) {
      const trimmed = input.name.trim();
      if (!trimmed) throw new HttpError(400, "请输入数据表名称");
      table.name = trimmed;
    }
    if (input.description !== undefined) table.description = input.description.trim();
    table.updatedAt = now;
    return {
      ...table,
      recordCount: memory.records.filter((r) => r.tableId === tableId).length,
    };
  }

  const res = await pool.query<{
    id: string;
    base_id: string;
    name: string;
    description: string;
    sort_order: number;
    created_at: Date;
  }>("SELECT * FROM bitable_tables WHERE id = $1", [tableId]);
  const existing = res.rows[0];
  if (!existing) throw new HttpError(404, "数据表不存在");

  const nextName = input.name !== undefined ? input.name.trim() : existing.name;
  if (!nextName) throw new HttpError(400, "请输入数据表名称");
  const nextDesc =
    input.description !== undefined ? input.description.trim() : existing.description;

  await pool.query(
    "UPDATE bitable_tables SET name = $2, description = $3, updated_at = $4 WHERE id = $1",
    [tableId, nextName, nextDesc, now]
  );

  const countRes = await pool.query<{ count: string }>(
    "SELECT COUNT(*)::text AS count FROM bitable_records WHERE table_id = $1",
    [tableId]
  );

  return {
    id: existing.id,
    baseId: existing.base_id,
    name: nextName,
    description: nextDesc,
    sortOrder: existing.sort_order,
    recordCount: Number(countRes.rows[0]?.count ?? 0),
    createdAt: toIso(existing.created_at),
    updatedAt: now,
  };
}

export async function deleteTable(tableId: string): Promise<void> {
  const { mode, pool, memory } = await ensureStorage();
  if (mode === "memory" || !pool) {
    const idx = memory.tables.findIndex((t) => t.id === tableId);
    if (idx === -1) throw new HttpError(404, "数据表不存在");
    memory.tables.splice(idx, 1);
    const removedFieldIds = new Set(
      memory.fields.filter((f) => f.tableId === tableId).map((f) => f.id)
    );
    const removedRecordIds = new Set(
      memory.records.filter((r) => r.tableId === tableId).map((r) => r.id)
    );
    memory.fields = memory.fields.filter((f) => f.tableId !== tableId);
    memory.views = memory.views.filter((v) => v.tableId !== tableId);
    memory.records = memory.records.filter((r) => r.tableId !== tableId);
    memory.relationEdges = memory.relationEdges.filter(
      (e) =>
        !removedFieldIds.has(e.fieldId) &&
        !removedRecordIds.has(e.sourceRecordId) &&
        !removedRecordIds.has(e.targetRecordId)
    );
    return;
  }

  const res = await pool.query("DELETE FROM bitable_tables WHERE id = $1", [tableId]);
  if (res.rowCount === 0) throw new HttpError(404, "数据表不存在");
}

export async function createField(
  tableId: string,
  input: {
    name: string;
    type: FieldType;
    required?: boolean;
    width?: number;
    config?: FieldConfig;
  }
): Promise<FieldSchema> {
  const name = input.name.trim();
  if (!name) throw new HttpError(400, "请输入字段名称");
  const def = FIELD_REGISTRY[input.type];
  if (!def) throw new HttpError(400, "不支持的字段类型");

  const now = new Date().toISOString();
  const fieldId = makeId("fld");
  const width = input.width ?? def.defaultWidth;
  const required = Boolean(input.required);
  const config = input.config ?? {};

  const { mode, pool, memory } = await ensureStorage();
  if (mode === "memory" || !pool) {
    if (!memory.tables.some((t) => t.id === tableId)) {
      throw new HttpError(404, "数据表不存在");
    }
    const siblings = memory.fields.filter((f) => f.tableId === tableId);
    const sortOrder =
      siblings.length > 0 ? Math.max(...siblings.map((f) => f.sortOrder)) + 1 : 0;
    const field: FieldSchema = {
      id: fieldId,
      tableId,
      name,
      type: input.type,
      required,
      isPrimary: siblings.length === 0,
      width,
      config,
      sortOrder,
      createdAt: now,
      updatedAt: now,
    };
    memory.fields.push(field);
    return field;
  }

  const tableCheck = await pool.query("SELECT id FROM bitable_tables WHERE id = $1", [tableId]);
  if (tableCheck.rowCount === 0) throw new HttpError(404, "数据表不存在");

  const orderRes = await pool.query<{ next_order: number; total: string }>(
    "SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_order, COUNT(*)::text AS total FROM bitable_fields WHERE table_id = $1",
    [tableId]
  );
  const sortOrder = orderRes.rows[0]?.next_order ?? 0;
  const isPrimary = Number(orderRes.rows[0]?.total ?? 0) === 0;

  await pool.query(
    `INSERT INTO bitable_fields (id, table_id, name, type, required, is_primary, width, config, sort_order, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10, $11)`,
    [
      fieldId,
      tableId,
      name,
      input.type,
      required,
      isPrimary,
      width,
      JSON.stringify(config),
      sortOrder,
      now,
      now,
    ]
  );

  return {
    id: fieldId,
    tableId,
    name,
    type: input.type,
    required,
    isPrimary,
    width,
    config,
    sortOrder,
    createdAt: now,
    updatedAt: now,
  };
}

export async function updateField(
  fieldId: string,
  input: {
    name?: string;
    type?: FieldType;
    required?: boolean;
    width?: number;
    config?: FieldConfig;
  }
): Promise<FieldSchema> {
  const now = new Date().toISOString();
  const { mode, pool, memory } = await ensureStorage();
  if (mode === "memory" || !pool) {
    const field = memory.fields.find((f) => f.id === fieldId);
    if (!field) throw new HttpError(404, "字段不存在");
    if (input.name !== undefined) {
      const trimmed = input.name.trim();
      if (!trimmed) throw new HttpError(400, "请输入字段名称");
      field.name = trimmed;
    }
    if (input.type !== undefined) {
      if (!FIELD_REGISTRY[input.type]) throw new HttpError(400, "不支持的字段类型");
      if (field.type === "relation" && input.type !== "relation") {
        memory.relationEdges = memory.relationEdges.filter((e) => e.fieldId !== fieldId);
      }
      field.type = input.type;
    }
    if (input.required !== undefined) field.required = input.required;
    if (input.width !== undefined) field.width = Math.max(80, Math.min(640, Math.round(input.width)));
    if (input.config !== undefined) field.config = input.config;
    field.updatedAt = now;
    return { ...field };
  }

  const res = await pool.query<{
    id: string;
    table_id: string;
    name: string;
    type: FieldType;
    required: boolean;
    is_primary: boolean;
    width: number;
    config: FieldConfig;
    sort_order: number;
    created_at: Date;
  }>("SELECT * FROM bitable_fields WHERE id = $1", [fieldId]);
  const existing = res.rows[0];
  if (!existing) throw new HttpError(404, "字段不存在");

  const nextName = input.name !== undefined ? input.name.trim() : existing.name;
  if (!nextName) throw new HttpError(400, "请输入字段名称");
  const nextType = input.type ?? existing.type;
  if (!FIELD_REGISTRY[nextType]) throw new HttpError(400, "不支持的字段类型");
  const nextRequired = input.required !== undefined ? input.required : existing.required;
  const nextWidth =
    input.width !== undefined
      ? Math.max(80, Math.min(640, Math.round(input.width)))
      : existing.width;
  const nextConfig = input.config !== undefined ? input.config : existing.config ?? {};

  if (existing.type === "relation" && nextType !== "relation") {
    await pool.query("DELETE FROM bitable_relation_edges WHERE field_id = $1", [fieldId]);
  }

  await pool.query(
    `UPDATE bitable_fields
     SET name = $2, type = $3, required = $4, width = $5, config = $6::jsonb, updated_at = $7
     WHERE id = $1`,
    [fieldId, nextName, nextType, nextRequired, nextWidth, JSON.stringify(nextConfig), now]
  );

  return {
    id: existing.id,
    tableId: existing.table_id,
    name: nextName,
    type: nextType,
    required: nextRequired,
    isPrimary: existing.is_primary,
    width: nextWidth,
    config: nextConfig,
    sortOrder: existing.sort_order,
    createdAt: toIso(existing.created_at),
    updatedAt: now,
  };
}

export async function deleteField(fieldId: string): Promise<void> {
  const { mode, pool, memory } = await ensureStorage();
  if (mode === "memory" || !pool) {
    const field = memory.fields.find((f) => f.id === fieldId);
    if (!field) throw new HttpError(404, "字段不存在");
    if (field.isPrimary) throw new HttpError(400, "主字段不可删除");
    memory.fields = memory.fields.filter((f) => f.id !== fieldId);
    memory.relationEdges = memory.relationEdges.filter((e) => e.fieldId !== fieldId);
    for (const record of memory.records) {
      if (record.tableId === field.tableId) {
        delete record.values[fieldId];
      }
    }
    return;
  }

  const res = await pool.query<{ is_primary: boolean; table_id: string }>(
    "SELECT is_primary, table_id FROM bitable_fields WHERE id = $1",
    [fieldId]
  );
  const existing = res.rows[0];
  if (!existing) throw new HttpError(404, "字段不存在");
  if (existing.is_primary) throw new HttpError(400, "主字段不可删除");

  await pool.query("DELETE FROM bitable_fields WHERE id = $1", [fieldId]);
  await pool.query(
    "UPDATE bitable_records SET values = values - $2 WHERE table_id = $1",
    [existing.table_id, fieldId]
  );
}

export async function createView(
  tableId: string,
  input: { name: string; type: ViewType; config?: ViewConfig }
): Promise<ViewSchema> {
  const name = input.name.trim();
  if (!name) throw new HttpError(400, "请输入视图名称");
  const now = new Date().toISOString();
  const viewId = makeId("view");
  const config = input.config ?? {};

  const { mode, pool, memory } = await ensureStorage();
  if (mode === "memory" || !pool) {
    if (!memory.tables.some((t) => t.id === tableId)) {
      throw new HttpError(404, "数据表不存在");
    }
    const siblings = memory.views.filter((v) => v.tableId === tableId);
    const sortOrder =
      siblings.length > 0 ? Math.max(...siblings.map((v) => v.sortOrder)) + 1 : 0;
    const view: ViewSchema = {
      id: viewId,
      tableId,
      name,
      type: input.type,
      config,
      sortOrder,
      createdAt: now,
      updatedAt: now,
    };
    memory.views.push(view);
    return view;
  }

  const orderRes = await pool.query<{ next_order: number }>(
    "SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_order FROM bitable_views WHERE table_id = $1",
    [tableId]
  );
  const sortOrder = orderRes.rows[0]?.next_order ?? 0;

  await pool.query(
    `INSERT INTO bitable_views (id, table_id, name, type, config, sort_order, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8)`,
    [viewId, tableId, name, input.type, JSON.stringify(config), sortOrder, now, now]
  );

  return {
    id: viewId,
    tableId,
    name,
    type: input.type,
    config,
    sortOrder,
    createdAt: now,
    updatedAt: now,
  };
}

export async function updateView(
  viewId: string,
  input: { name?: string; type?: ViewType; config?: ViewConfig }
): Promise<ViewSchema> {
  const now = new Date().toISOString();
  const { mode, pool, memory } = await ensureStorage();
  if (mode === "memory" || !pool) {
    const view = memory.views.find((v) => v.id === viewId);
    if (!view) throw new HttpError(404, "视图不存在");
    if (input.name !== undefined) {
      const trimmed = input.name.trim();
      if (!trimmed) throw new HttpError(400, "请输入视图名称");
      view.name = trimmed;
    }
    if (input.type !== undefined) view.type = input.type;
    if (input.config !== undefined) view.config = { ...view.config, ...input.config };
    view.updatedAt = now;
    return { ...view };
  }

  const res = await pool.query<{
    id: string;
    table_id: string;
    name: string;
    type: ViewType;
    config: ViewConfig;
    sort_order: number;
    created_at: Date;
  }>("SELECT * FROM bitable_views WHERE id = $1", [viewId]);
  const existing = res.rows[0];
  if (!existing) throw new HttpError(404, "视图不存在");

  const nextName = input.name !== undefined ? input.name.trim() : existing.name;
  if (!nextName) throw new HttpError(400, "请输入视图名称");
  const nextType = input.type ?? existing.type;
  const nextConfig =
    input.config !== undefined
      ? { ...(existing.config ?? {}), ...input.config }
      : existing.config ?? {};

  await pool.query(
    "UPDATE bitable_views SET name = $2, type = $3, config = $4::jsonb, updated_at = $5 WHERE id = $1",
    [viewId, nextName, nextType, JSON.stringify(nextConfig), now]
  );

  return {
    id: existing.id,
    tableId: existing.table_id,
    name: nextName,
    type: nextType,
    config: nextConfig,
    sortOrder: existing.sort_order,
    createdAt: toIso(existing.created_at),
    updatedAt: now,
  };
}

export async function deleteView(viewId: string): Promise<void> {
  const { mode, pool, memory } = await ensureStorage();
  if (mode === "memory" || !pool) {
    const view = memory.views.find((v) => v.id === viewId);
    if (!view) throw new HttpError(404, "视图不存在");
    const siblings = memory.views.filter((v) => v.tableId === view.tableId);
    if (siblings.length <= 1) throw new HttpError(400, "至少保留一个视图");
    memory.views = memory.views.filter((v) => v.id !== viewId);
    return;
  }

  const res = await pool.query<{ table_id: string }>(
    "SELECT table_id FROM bitable_views WHERE id = $1",
    [viewId]
  );
  const existing = res.rows[0];
  if (!existing) throw new HttpError(404, "视图不存在");

  const countRes = await pool.query<{ count: string }>(
    "SELECT COUNT(*)::text AS count FROM bitable_views WHERE table_id = $1",
    [existing.table_id]
  );
  if (Number(countRes.rows[0]?.count ?? 0) <= 1) {
    throw new HttpError(400, "至少保留一个视图");
  }

  await pool.query("DELETE FROM bitable_views WHERE id = $1", [viewId]);
}

export async function createRecord(
  tableId: string,
  rawValues: Record<string, unknown> = {}
): Promise<RecordData> {
  const now = new Date().toISOString();
  const recordId = makeId("rec");

  const { mode, pool, memory } = await ensureStorage();
  if (mode === "memory" || !pool) {
    if (!memory.tables.some((t) => t.id === tableId)) {
      throw new HttpError(404, "数据表不存在");
    }
    const fields = memory.fields.filter((f) => f.tableId === tableId);
    const values: Record<string, unknown> = {};
    for (const field of fields) {
      values[field.id] = normalizeFieldValue(field, rawValues[field.id]);
    }
    const siblings = memory.records.filter((r) => r.tableId === tableId);
    const sortOrder =
      siblings.length > 0 ? Math.max(...siblings.map((r) => r.sortOrder)) + 1 : 0;

    const record: RecordData = {
      id: recordId,
      tableId,
      values,
      sortOrder,
      createdAt: now,
      updatedAt: now,
    };
    memory.records.push(record);

    for (const field of fields) {
      if (field.type === "relation") {
        const targetIds = Array.isArray(values[field.id])
          ? (values[field.id] as string[])
          : [];
        targetIds.forEach((targetRecordId, idx) => {
          memory.relationEdges.push({
            id: makeId("edge"),
            fieldId: field.id,
            sourceRecordId: recordId,
            targetRecordId,
            sortOrder: idx,
          });
        });
      }
    }
    return record;
  }

  const fieldsRes = await pool.query<{
    id: string;
    table_id: string;
    name: string;
    type: FieldType;
    required: boolean;
    is_primary: boolean;
    width: number;
    config: FieldConfig;
    sort_order: number;
    created_at: Date;
    updated_at: Date;
  }>("SELECT * FROM bitable_fields WHERE table_id = $1", [tableId]);

  if (fieldsRes.rowCount === 0) {
    const tableCheck = await pool.query("SELECT id FROM bitable_tables WHERE id = $1", [tableId]);
    if (tableCheck.rowCount === 0) throw new HttpError(404, "数据表不存在");
  }

  const fields: FieldSchema[] = fieldsRes.rows.map((row) => ({
    id: row.id,
    tableId: row.table_id,
    name: row.name,
    type: row.type,
    required: row.required,
    isPrimary: row.is_primary,
    width: row.width,
    config: row.config ?? {},
    sortOrder: row.sort_order,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  }));

  const values: Record<string, unknown> = {};
  for (const field of fields) {
    values[field.id] = normalizeFieldValue(field, rawValues[field.id]);
  }

  const orderRes = await pool.query<{ next_order: number }>(
    "SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_order FROM bitable_records WHERE table_id = $1",
    [tableId]
  );
  const sortOrder = orderRes.rows[0]?.next_order ?? 0;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `INSERT INTO bitable_records (id, table_id, values, sort_order, created_at, updated_at)
       VALUES ($1, $2, $3::jsonb, $4, $5, $6)`,
      [recordId, tableId, JSON.stringify(values), sortOrder, now, now]
    );
    for (const field of fields) {
      if (field.type === "relation") {
        const targetIds = Array.isArray(values[field.id])
          ? (values[field.id] as string[])
          : [];
        for (let idx = 0; idx < targetIds.length; idx++) {
          await client.query(
            `INSERT INTO bitable_relation_edges (id, field_id, source_record_id, target_record_id, sort_order)
             VALUES ($1, $2, $3, $4, $5) ON CONFLICT DO NOTHING`,
            [makeId("edge"), field.id, recordId, targetIds[idx], idx]
          );
        }
      }
    }
    await client.query("COMMIT");
    return {
      id: recordId,
      tableId,
      values,
      sortOrder,
      createdAt: now,
      updatedAt: now,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

const MAX_INSERT_COUNT = 20;

export async function insertRecords(
  tableId: string,
  anchorRecordId: string,
  position: "before" | "after",
  count: number
): Promise<RecordData[]> {
  if (!Number.isInteger(count) || count < 1 || count > MAX_INSERT_COUNT) {
    throw new HttpError(400, "插入条数需要在 1 到 20 之间");
  }

  const now = new Date().toISOString();
  const { mode, pool, memory } = await ensureStorage();

  function emptyValues(fields: FieldSchema[]): Record<string, unknown> {
    const values: Record<string, unknown> = {};
    for (const field of fields) {
      values[field.id] = normalizeFieldValue(field, undefined);
    }
    return values;
  }

  if (mode === "memory" || !pool) {
    if (!memory.tables.some((t) => t.id === tableId)) {
      throw new HttpError(404, "数据表不存在");
    }
    const anchor = memory.records.find(
      (record) => record.id === anchorRecordId && record.tableId === tableId
    );
    if (!anchor) throw new HttpError(404, "记录不存在");
    const fields = memory.fields.filter((field) => field.tableId === tableId);
    const start =
      position === "before" ? anchor.sortOrder : anchor.sortOrder + 1;
    for (const record of memory.records) {
      if (record.tableId === tableId && record.sortOrder >= start) {
        record.sortOrder += count;
      }
    }
    const created: RecordData[] = [];
    for (let index = 0; index < count; index++) {
      const record: RecordData = {
        id: makeId("rec"),
        tableId,
        values: emptyValues(fields),
        sortOrder: start + index,
        createdAt: now,
        updatedAt: now,
      };
      memory.records.push(record);
      created.push(record);
    }
    return created;
  }

  const fieldsRes = await pool.query<{
    id: string;
    table_id: string;
    name: string;
    type: FieldType;
    required: boolean;
    is_primary: boolean;
    width: number;
    config: FieldConfig;
    sort_order: number;
    created_at: Date;
    updated_at: Date;
  }>("SELECT * FROM bitable_fields WHERE table_id = $1", [tableId]);
  if (fieldsRes.rowCount === 0) {
    const tableCheck = await pool.query(
      "SELECT id FROM bitable_tables WHERE id = $1",
      [tableId]
    );
    if (tableCheck.rowCount === 0) throw new HttpError(404, "数据表不存在");
  }
  const fields: FieldSchema[] = fieldsRes.rows.map((row) => ({
    id: row.id,
    tableId: row.table_id,
    name: row.name,
    type: row.type,
    required: row.required,
    isPrimary: row.is_primary,
    width: row.width,
    config: row.config ?? {},
    sortOrder: row.sort_order,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  }));

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const anchorRes = await client.query<{ sort_order: number }>(
      "SELECT sort_order FROM bitable_records WHERE id = $1 AND table_id = $2 FOR UPDATE",
      [anchorRecordId, tableId]
    );
    const anchorOrder = anchorRes.rows[0]?.sort_order;
    if (anchorOrder === undefined) throw new HttpError(404, "记录不存在");
    const start = position === "before" ? anchorOrder : anchorOrder + 1;
    await client.query(
      `UPDATE bitable_records
       SET sort_order = sort_order + $3
       WHERE table_id = $1 AND sort_order >= $2`,
      [tableId, start, count]
    );
    const created: RecordData[] = [];
    for (let index = 0; index < count; index++) {
      const recordId = makeId("rec");
      const values = emptyValues(fields);
      const sortOrder = start + index;
      await client.query(
        `INSERT INTO bitable_records (id, table_id, values, sort_order, created_at, updated_at)
         VALUES ($1, $2, $3::jsonb, $4, $5, $6)`,
        [recordId, tableId, JSON.stringify(values), sortOrder, now, now]
      );
      created.push({
        id: recordId,
        tableId,
        values,
        sortOrder,
        createdAt: now,
        updatedAt: now,
      });
    }
    await client.query("COMMIT");
    return created;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function updateRecord(
  recordId: string,
  patchValues: Record<string, unknown>
): Promise<RecordData> {
  const now = new Date().toISOString();
  const { mode, pool, memory } = await ensureStorage();

  if (mode === "memory" || !pool) {
    const record = memory.records.find((r) => r.id === recordId);
    if (!record) throw new HttpError(404, "记录不存在");
    const fields = memory.fields.filter((f) => f.tableId === record.tableId);
    const fieldMap = new Map(fields.map((f) => [f.id, f]));

    for (const [fieldId, rawVal] of Object.entries(patchValues)) {
      const field = fieldMap.get(fieldId);
      if (!field) continue;
      const normalized = normalizeFieldValue(field, rawVal);
      record.values[fieldId] = normalized;
      if (field.type === "relation") {
        memory.relationEdges = memory.relationEdges.filter(
          (e) => !(e.fieldId === fieldId && e.sourceRecordId === recordId)
        );
        const targetIds = Array.isArray(normalized) ? (normalized as string[]) : [];
        targetIds.forEach((targetRecordId, idx) => {
          memory.relationEdges.push({
            id: makeId("edge"),
            fieldId,
            sourceRecordId: recordId,
            targetRecordId,
            sortOrder: idx,
          });
        });
      }
    }
    record.updatedAt = now;
    return { ...record, values: { ...record.values } };
  }

  const recRes = await pool.query<{
    id: string;
    table_id: string;
    values: Record<string, unknown>;
    sort_order: number;
    created_at: Date;
  }>("SELECT * FROM bitable_records WHERE id = $1", [recordId]);
  const existing = recRes.rows[0];
  if (!existing) throw new HttpError(404, "记录不存在");

  const fieldsRes = await pool.query<{
    id: string;
    table_id: string;
    name: string;
    type: FieldType;
    required: boolean;
    is_primary: boolean;
    width: number;
    config: FieldConfig;
    sort_order: number;
    created_at: Date;
    updated_at: Date;
  }>("SELECT * FROM bitable_fields WHERE table_id = $1", [existing.table_id]);

  const fieldMap = new Map<string, FieldSchema>(
    fieldsRes.rows.map((row) => [
      row.id,
      {
        id: row.id,
        tableId: row.table_id,
        name: row.name,
        type: row.type,
        required: row.required,
        isPrimary: row.is_primary,
        width: row.width,
        config: row.config ?? {},
        sortOrder: row.sort_order,
        createdAt: toIso(row.created_at),
        updatedAt: toIso(row.updated_at),
      },
    ])
  );

  const nextValues: Record<string, unknown> = { ...(existing.values ?? {}) };
  const relationUpdates: Array<{ fieldId: string; targetIds: string[] }> = [];

  for (const [fieldId, rawVal] of Object.entries(patchValues)) {
    const field = fieldMap.get(fieldId);
    if (!field) continue;
    const normalized = normalizeFieldValue(field, rawVal);
    nextValues[fieldId] = normalized;
    if (field.type === "relation") {
      relationUpdates.push({
        fieldId,
        targetIds: Array.isArray(normalized) ? (normalized as string[]) : [],
      });
    }
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      "UPDATE bitable_records SET values = $2::jsonb, updated_at = $3 WHERE id = $1",
      [recordId, JSON.stringify(nextValues), now]
    );
    for (const rel of relationUpdates) {
      await client.query(
        "DELETE FROM bitable_relation_edges WHERE field_id = $1 AND source_record_id = $2",
        [rel.fieldId, recordId]
      );
      for (let idx = 0; idx < rel.targetIds.length; idx++) {
        await client.query(
          `INSERT INTO bitable_relation_edges (id, field_id, source_record_id, target_record_id, sort_order)
           VALUES ($1, $2, $3, $4, $5) ON CONFLICT DO NOTHING`,
          [makeId("edge"), rel.fieldId, recordId, rel.targetIds[idx], idx]
        );
      }
    }
    await client.query("COMMIT");
    return {
      id: existing.id,
      tableId: existing.table_id,
      values: nextValues,
      sortOrder: existing.sort_order,
      createdAt: toIso(existing.created_at),
      updatedAt: now,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function deleteRecord(recordId: string): Promise<void> {
  const { mode, pool, memory } = await ensureStorage();
  if (mode === "memory" || !pool) {
    const idx = memory.records.findIndex((r) => r.id === recordId);
    if (idx === -1) throw new HttpError(404, "记录不存在");
    memory.records.splice(idx, 1);
    memory.relationEdges = memory.relationEdges.filter(
      (e) => e.sourceRecordId !== recordId && e.targetRecordId !== recordId
    );
    return;
  }

  const res = await pool.query("DELETE FROM bitable_records WHERE id = $1", [recordId]);
  if (res.rowCount === 0) throw new HttpError(404, "记录不存在");
}

export async function bulkDeleteRecords(
  tableId: string,
  recordIds: string[]
): Promise<number> {
  if (recordIds.length === 0) return 0;
  const { mode, pool, memory } = await ensureStorage();
  if (mode === "memory" || !pool) {
    const idSet = new Set(recordIds);
    const before = memory.records.length;
    memory.records = memory.records.filter(
      (r) => !(r.tableId === tableId && idSet.has(r.id))
    );
    memory.relationEdges = memory.relationEdges.filter(
      (e) => !idSet.has(e.sourceRecordId) && !idSet.has(e.targetRecordId)
    );
    return before - memory.records.length;
  }

  const res = await pool.query(
    "DELETE FROM bitable_records WHERE table_id = $1 AND id = ANY($2::text[])",
    [tableId, recordIds]
  );
  return res.rowCount ?? 0;
}
