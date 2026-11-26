import type { RecordData, RecordsPagePayload } from "@/lib/bitable/types";
import { ensureStorage } from "./db";
import { HttpError } from "./repository";

function toIso(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  return String(value ?? new Date().toISOString());
}

export async function getRecord(recordId: string): Promise<RecordData> {
  const { mode, pool, memory } = await ensureStorage();
  if (mode === "memory" || !pool) {
    const record = memory.records.find((item) => item.id === recordId);
    if (!record) throw new HttpError(404, "记录不存在");
    const relationFields = memory.fields.filter(
      (field) => field.tableId === record.tableId && field.type === "relation"
    );
    const values = { ...record.values };
    for (const field of relationFields) {
      values[field.id] = memory.relationEdges
        .filter(
          (edge) => edge.fieldId === field.id && edge.sourceRecordId === record.id
        )
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((edge) => edge.targetRecordId);
    }
    return { ...record, values };
  }

  const recordRes = await pool.query<{
    id: string;
    table_id: string;
    values: Record<string, unknown>;
    sort_order: number;
    created_at: Date;
    updated_at: Date;
  }>("SELECT * FROM bitable_records WHERE id = $1", [recordId]);
  const row = recordRes.rows[0];
  if (!row) throw new HttpError(404, "记录不存在");

  const fieldsRes = await pool.query<{ id: string }>(
    "SELECT id FROM bitable_fields WHERE table_id = $1 AND type = 'relation'",
    [row.table_id]
  );
  const values = { ...(row.values ?? {}) };
  if (fieldsRes.rows.length > 0) {
    const edgesRes = await pool.query<{
      field_id: string;
      target_record_id: string;
    }>(
      `SELECT field_id, target_record_id
       FROM bitable_relation_edges
       WHERE source_record_id = $1
       ORDER BY sort_order ASC`,
      [recordId]
    );
    for (const field of fieldsRes.rows) values[field.id] = [];
    for (const edge of edgesRes.rows) {
      const list = values[edge.field_id];
      if (Array.isArray(list)) list.push(edge.target_record_id);
    }
  }

  return {
    id: row.id,
    tableId: row.table_id,
    values,
    sortOrder: row.sort_order,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

export async function listTableRecordsPage(
  tableId: string,
  options?: { limit?: number; offset?: number }
): Promise<RecordsPagePayload> {
  const limit = Math.max(1, Math.min(200, Math.floor(options?.limit ?? 50)));
  const offset = Math.max(0, Math.floor(options?.offset ?? 0));
  const { mode, pool, memory } = await ensureStorage();

  if (mode === "memory" || !pool) {
    if (!memory.tables.some((t) => t.id === tableId)) {
      throw new HttpError(404, "数据表不存在");
    }
    const relationFields = memory.fields.filter(
      (f) => f.tableId === tableId && f.type === "relation"
    );
    const all = memory.records
      .filter((r) => r.tableId === tableId)
      .sort((a, b) => a.sortOrder - b.sortOrder);
    const total = all.length;
    const records = all.slice(offset, offset + limit).map((record) => {
      const nextValues = { ...record.values };
      for (const field of relationFields) {
        nextValues[field.id] = memory.relationEdges
          .filter((e) => e.fieldId === field.id && e.sourceRecordId === record.id)
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map((e) => e.targetRecordId);
      }
      return { ...record, values: nextValues };
    });
    return {
      records,
      total,
      hasMore: offset + records.length < total,
      nextOffset: offset + records.length,
    };
  }

  const [countRes, fieldsRes, recordsRes] = await Promise.all([
    pool.query<{ count: string }>(
      "SELECT COUNT(*)::text AS count FROM bitable_records WHERE table_id = $1",
      [tableId]
    ),
    pool.query<{ id: string }>(
      "SELECT id FROM bitable_fields WHERE table_id = $1 AND type = 'relation'",
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
      "SELECT * FROM bitable_records WHERE table_id = $1 ORDER BY sort_order ASC, created_at ASC LIMIT $2 OFFSET $3",
      [tableId, limit, offset]
    ),
  ]);

  const total = Number(countRes.rows[0]?.count ?? 0);
  const relationFieldIds = new Set(fieldsRes.rows.map((r) => r.id));
  const recordIds = recordsRes.rows.map((r) => r.id);

  const edgeMap = new Map<string, string[]>();
  if (relationFieldIds.size > 0 && recordIds.length > 0) {
    const edgesRes = await pool.query<{
      field_id: string;
      source_record_id: string;
      target_record_id: string;
    }>(
      `SELECT e.field_id, e.source_record_id, e.target_record_id
       FROM bitable_relation_edges e
       INNER JOIN bitable_fields f ON f.id = e.field_id
       WHERE f.table_id = $1 AND e.source_record_id = ANY($2::text[])
       ORDER BY e.sort_order ASC`,
      [tableId, recordIds]
    );
    for (const edge of edgesRes.rows) {
      const key = `${edge.source_record_id}:${edge.field_id}`;
      const list = edgeMap.get(key) ?? [];
      list.push(edge.target_record_id);
      edgeMap.set(key, list);
    }
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

  return {
    records,
    total,
    hasMore: offset + records.length < total,
    nextOffset: offset + records.length,
  };
}
