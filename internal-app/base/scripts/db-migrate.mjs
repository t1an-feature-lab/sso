import { randomBytes, scrypt } from "node:crypto";
import { promisify } from "node:util";
import { Pool } from "pg";

const deriveKey = promisify(scrypt);

const DATABASE_URL =
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

async function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const key = await deriveKey(password, salt, 64);
  return `${salt}:${Buffer.from(key).toString("hex")}`;
}

async function main() {
  const pool = new Pool({ connectionString: DATABASE_URL });
  try {
    await pool.query(SCHEMA_SQL);

    const existing = await pool.query(
      "SELECT id FROM bitable_users WHERE username = $1",
      ["admin"]
    );
    if (existing.rows.length === 0) {
      const passwordHash = await hashPassword("admin");
      await pool.query(
        `INSERT INTO bitable_users (id, username, password_hash, role, is_built_in)
         VALUES ($1, $2, $3, 'admin', TRUE)
         ON CONFLICT (username) DO NOTHING`,
        ["usr_admin", "admin", passwordHash]
      );
      console.log("已初始化内置管理员账号 admin");
    }

    console.log("base 数据库迁移完成");
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error("base 数据库迁移失败:", error);
  process.exit(1);
});
