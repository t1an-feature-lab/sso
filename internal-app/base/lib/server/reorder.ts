import { ensureStorage } from "./db";

let ensuredBaseSortColumn = false;

async function ensureBaseSortOrderColumn(
  pool: NonNullable<Awaited<ReturnType<typeof ensureStorage>>["pool"]>
) {
  if (ensuredBaseSortColumn) return;
  await pool.query(
    "ALTER TABLE bitable_bases ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0"
  );
  ensuredBaseSortColumn = true;
}

export async function reorderBases(baseIds: string[]): Promise<void> {
  if (baseIds.length === 0) return;
  const { mode, pool, memory } = await ensureStorage();
  if (mode === "memory" || !pool) {
    const orderMap = new Map(baseIds.map((id, idx) => [id, idx]));
    for (const base of memory.bases) {
      const next = orderMap.get(base.id);
      if (next !== undefined) base.sortOrder = next;
    }
    return;
  }

  await ensureBaseSortOrderColumn(pool);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (let idx = 0; idx < baseIds.length; idx++) {
      await client.query(
        "UPDATE bitable_bases SET sort_order = $2 WHERE id = $1",
        [baseIds[idx], idx]
      );
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function reorderTables(
  baseId: string,
  tableIds: string[]
): Promise<void> {
  if (tableIds.length === 0) return;
  const { mode, pool, memory } = await ensureStorage();
  if (mode === "memory" || !pool) {
    const orderMap = new Map(tableIds.map((id, idx) => [id, idx]));
    for (const table of memory.tables) {
      if (table.baseId !== baseId) continue;
      const next = orderMap.get(table.id);
      if (next !== undefined) table.sortOrder = next;
    }
    return;
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (let idx = 0; idx < tableIds.length; idx++) {
      await client.query(
        "UPDATE bitable_tables SET sort_order = $3 WHERE id = $1 AND base_id = $2",
        [tableIds[idx], baseId, idx]
      );
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function reorderRecords(
  tableId: string,
  items: { id: string; sortOrder: number }[]
): Promise<void> {
  if (items.length === 0) return;
  const { mode, pool, memory } = await ensureStorage();
  if (mode === "memory" || !pool) {
    const orderMap = new Map(items.map((item) => [item.id, item.sortOrder]));
    for (const record of memory.records) {
      if (record.tableId !== tableId) continue;
      const next = orderMap.get(record.id);
      if (next !== undefined) record.sortOrder = next;
    }
    return;
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const item of items) {
      await client.query(
        "UPDATE bitable_records SET sort_order = $3 WHERE id = $1 AND table_id = $2",
        [item.id, tableId, item.sortOrder]
      );
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function reorderViews(
  tableId: string,
  viewIds: string[]
): Promise<void> {
  if (viewIds.length === 0) return;
  const { mode, pool, memory } = await ensureStorage();
  if (mode === "memory" || !pool) {
    const orderMap = new Map(viewIds.map((id, idx) => [id, idx]));
    for (const view of memory.views) {
      if (view.tableId !== tableId) continue;
      const next = orderMap.get(view.id);
      if (next !== undefined) view.sortOrder = next;
    }
    return;
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (let idx = 0; idx < viewIds.length; idx++) {
      await client.query(
        "UPDATE bitable_views SET sort_order = $3 WHERE id = $1 AND table_id = $2",
        [viewIds[idx], tableId, idx]
      );
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
