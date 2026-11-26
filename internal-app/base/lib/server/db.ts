import { Pool } from "pg";
import {
  BUILT_IN_ADMIN_INITIAL_PASSWORD,
  BUILT_IN_ADMIN_USERNAME,
  type UserRole,
} from "@/lib/auth/types";
import { createSeedDataset, type SeedDataset } from "@/lib/bitable/seed";
import { hashPassword } from "./password";

export type StorageMode = "postgres" | "memory";

export interface StoredUser {
  id: string;
  username: string;
  passwordHash: string;
  role: UserRole;
  isBuiltIn: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface StoredSession {
  tokenHash: string;
  userId: string;
  expiresAt: string;
  createdAt: string;
}

export interface MemoryAuthStore {
  users: StoredUser[];
  sessions: StoredSession[];
}

const SCHEMA_VERSION = 3;

interface GlobalStoreState {
  pool: Pool | null;
  mode: StorageMode | null;
  initPromise: Promise<StorageMode> | null;
  schemaVersion?: number;
  memoryData: SeedDataset | null;
  memoryAuth: MemoryAuthStore | null;
}

const globalForBitable = globalThis as unknown as {
  __bitableStore?: GlobalStoreState;
};

const state: GlobalStoreState =
  globalForBitable.__bitableStore ??
  (globalForBitable.__bitableStore = {
    pool: null,
    mode: null,
    initPromise: null,
    memoryData: null,
    memoryAuth: null,
  });

const DEFAULT_DB_URL =
  process.env.DATABASE_URL ??
  "postgresql://postgres:postgres@127.0.0.1:5432/internal_app";

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS bitable_bases (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  icon_color TEXT NOT NULL DEFAULT '#2563eb',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE bitable_bases ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS bitable_tables (
  id TEXT PRIMARY KEY,
  base_id TEXT NOT NULL REFERENCES bitable_bases(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bitable_tables_base_id ON bitable_tables(base_id);

CREATE TABLE IF NOT EXISTS bitable_fields (
  id TEXT PRIMARY KEY,
  table_id TEXT NOT NULL REFERENCES bitable_tables(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  required BOOLEAN NOT NULL DEFAULT FALSE,
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  width INTEGER NOT NULL DEFAULT 180,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bitable_fields_table_id ON bitable_fields(table_id);

CREATE TABLE IF NOT EXISTS bitable_views (
  id TEXT PRIMARY KEY,
  table_id TEXT NOT NULL REFERENCES bitable_tables(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bitable_views_table_id ON bitable_views(table_id);

CREATE TABLE IF NOT EXISTS bitable_records (
  id TEXT PRIMARY KEY,
  table_id TEXT NOT NULL REFERENCES bitable_tables(id) ON DELETE CASCADE,
  values JSONB NOT NULL DEFAULT '{}'::jsonb,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bitable_records_table_id ON bitable_records(table_id);

CREATE TABLE IF NOT EXISTS bitable_relation_edges (
  id TEXT PRIMARY KEY,
  field_id TEXT NOT NULL REFERENCES bitable_fields(id) ON DELETE CASCADE,
  source_record_id TEXT NOT NULL REFERENCES bitable_records(id) ON DELETE CASCADE,
  target_record_id TEXT NOT NULL REFERENCES bitable_records(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (field_id, source_record_id, target_record_id)
);

CREATE INDEX IF NOT EXISTS idx_bitable_edges_field_source ON bitable_relation_edges(field_id, source_record_id);
CREATE INDEX IF NOT EXISTS idx_bitable_edges_target ON bitable_relation_edges(target_record_id);

CREATE TABLE IF NOT EXISTS bitable_users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user',
  is_built_in BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bitable_sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES bitable_users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bitable_sessions_user_id ON bitable_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_bitable_sessions_expires_at ON bitable_sessions(expires_at);
`;

async function ensureBuiltInAdminPostgres(pool: Pool): Promise<void> {
  const existing = await pool.query<{ id: string }>(
    "SELECT id FROM bitable_users WHERE username = $1",
    [BUILT_IN_ADMIN_USERNAME]
  );
  if (existing.rows.length > 0) return;

  const passwordHash = await hashPassword(BUILT_IN_ADMIN_INITIAL_PASSWORD);
  await pool.query(
    `INSERT INTO bitable_users (id, username, password_hash, role, is_built_in)
     VALUES ($1, $2, $3, 'admin', TRUE)
     ON CONFLICT (username) DO NOTHING`,
    ["usr_admin", BUILT_IN_ADMIN_USERNAME, passwordHash]
  );
}

async function ensureMemoryAuth(): Promise<MemoryAuthStore> {
  if (!state.memoryAuth) {
    const now = new Date().toISOString();
    const passwordHash = await hashPassword(BUILT_IN_ADMIN_INITIAL_PASSWORD);
    state.memoryAuth = {
      users: [
        {
          id: "usr_admin",
          username: BUILT_IN_ADMIN_USERNAME,
          passwordHash,
          role: "admin",
          isBuiltIn: true,
          createdAt: now,
          updatedAt: now,
        },
      ],
      sessions: [],
    };
  }
  return state.memoryAuth;
}

async function seedPostgres(pool: Pool): Promise<void> {
  const countRes = await pool.query<{ count: string }>(
    "SELECT COUNT(*)::text AS count FROM bitable_bases"
  );
  if (Number(countRes.rows[0]?.count ?? 0) > 0) {
    return;
  }

  const seed = createSeedDataset();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const base of seed.bases) {
      await client.query(
        `INSERT INTO bitable_bases (id, name, description, icon_color, sort_order, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT (id) DO NOTHING`,
        [base.id, base.name, base.description, base.iconColor, base.sortOrder, base.createdAt, base.updatedAt]
      );
    }
    for (const table of seed.tables) {
      await client.query(
        `INSERT INTO bitable_tables (id, base_id, name, description, sort_order, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT (id) DO NOTHING`,
        [
          table.id,
          table.baseId,
          table.name,
          table.description,
          table.sortOrder,
          table.createdAt,
          table.updatedAt,
        ]
      );
    }
    for (const field of seed.fields) {
      await client.query(
        `INSERT INTO bitable_fields (id, table_id, name, type, required, is_primary, width, config, sort_order, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10, $11) ON CONFLICT (id) DO NOTHING`,
        [
          field.id,
          field.tableId,
          field.name,
          field.type,
          field.required,
          field.isPrimary,
          field.width,
          JSON.stringify(field.config),
          field.sortOrder,
          field.createdAt,
          field.updatedAt,
        ]
      );
    }
    for (const view of seed.views) {
      await client.query(
        `INSERT INTO bitable_views (id, table_id, name, type, config, sort_order, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8) ON CONFLICT (id) DO NOTHING`,
        [
          view.id,
          view.tableId,
          view.name,
          view.type,
          JSON.stringify(view.config),
          view.sortOrder,
          view.createdAt,
          view.updatedAt,
        ]
      );
    }
    for (const record of seed.records) {
      await client.query(
        `INSERT INTO bitable_records (id, table_id, values, sort_order, created_at, updated_at)
         VALUES ($1, $2, $3::jsonb, $4, $5, $6) ON CONFLICT (id) DO NOTHING`,
        [
          record.id,
          record.tableId,
          JSON.stringify(record.values),
          record.sortOrder,
          record.createdAt,
          record.updatedAt,
        ]
      );
    }
    for (const edge of seed.relationEdges) {
      await client.query(
        `INSERT INTO bitable_relation_edges (id, field_id, source_record_id, target_record_id, sort_order)
         VALUES ($1, $2, $3, $4, $5) ON CONFLICT (id) DO NOTHING`,
        [edge.id, edge.fieldId, edge.sourceRecordId, edge.targetRecordId, edge.sortOrder]
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

export async function ensureStorage(): Promise<{
  mode: StorageMode;
  pool: Pool | null;
  memory: SeedDataset;
  memoryAuth: MemoryAuthStore;
}> {
  if (state.mode) {
    if (
      state.mode === "postgres" &&
      state.pool &&
      state.schemaVersion !== SCHEMA_VERSION
    ) {
      await state.pool.query(SCHEMA_SQL);
      await ensureBuiltInAdminPostgres(state.pool);
      state.schemaVersion = SCHEMA_VERSION;
    }
    if (!state.memoryData) {
      state.memoryData = createSeedDataset();
    }
    const memoryAuth = await ensureMemoryAuth();
    return {
      mode: state.mode,
      pool: state.pool,
      memory: state.memoryData,
      memoryAuth,
    };
  }

  if (!state.initPromise) {
    state.initPromise = (async () => {
      const pool = new Pool({
        connectionString: DEFAULT_DB_URL,
        connectionTimeoutMillis: 2000,
        max: 10,
      });
      try {
        await pool.query("SELECT 1");
        await pool.query(SCHEMA_SQL);
        await seedPostgres(pool);
        await ensureBuiltInAdminPostgres(pool);
        state.pool = pool;
        state.mode = "postgres";
        state.schemaVersion = SCHEMA_VERSION;
        return "postgres" as const;
      } catch {
        await pool.end().catch(() => {});
        state.pool = null;
        state.mode = "memory";
        if (!state.memoryData) {
          state.memoryData = createSeedDataset();
        }
        await ensureMemoryAuth();
        return "memory" as const;
      }
    })();
  }

  await state.initPromise;
  if (!state.memoryData) {
    state.memoryData = createSeedDataset();
  }
  const memoryAuth = await ensureMemoryAuth();
  return {
    mode: state.mode!,
    pool: state.pool,
    memory: state.memoryData,
    memoryAuth,
  };
}
