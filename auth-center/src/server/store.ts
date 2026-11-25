import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { QueryTypes } from "sequelize";
import { db } from "./db";
import { hashPassword } from "./password";
import { encryptClientSecret } from "./secret-cipher";

const globalStore = globalThis as typeof globalThis & {
  ssoSchemaState?: { version: number; ready: Promise<void> };
};

const schemaVersion = 6;

async function initializeStore() {
  const adminPassword = await hashPassword("admin");
  await db.transaction(async (transaction) => {
    // Serialize first-run setup across server workers without changing existing tables.
    await db.query("SELECT pg_advisory_xact_lock(713461205)", { transaction });
    await db.query(`
      CREATE TABLE IF NOT EXISTS sso_users (
        id UUID PRIMARY KEY,
        username VARCHAR(64) NOT NULL UNIQUE,
        phone VARCHAR(20) UNIQUE,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL CHECK (role IN ('admin', 'user')),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS sso_sessions (
        token_hash CHAR(64) PRIMARY KEY,
        user_id UUID NOT NULL REFERENCES sso_users(id) ON DELETE CASCADE,
        expires_at TIMESTAMPTZ NOT NULL
      );
      ALTER TABLE sso_users
        ADD COLUMN IF NOT EXISTS login_account VARCHAR(64),
        ADD COLUMN IF NOT EXISTS avatar_data BYTEA,
        ADD COLUMN IF NOT EXISTS avatar_mime TEXT,
        ADD COLUMN IF NOT EXISTS avatar_updated_at TIMESTAMPTZ;
      UPDATE sso_users SET login_account = COALESCE(phone, username) WHERE login_account IS NULL;
      ALTER TABLE sso_users ALTER COLUMN login_account SET NOT NULL;
      CREATE UNIQUE INDEX IF NOT EXISTS sso_users_login_account_idx ON sso_users(login_account);
      CREATE TABLE IF NOT EXISTS sso_client_applications (
        id UUID PRIMARY KEY,
        owner_id UUID NOT NULL REFERENCES sso_users(id) ON DELETE CASCADE,
        name VARCHAR(80) NOT NULL,
        client_id TEXT NOT NULL UNIQUE,
        client_secret TEXT NOT NULL,
        redirect_uris JSONB NOT NULL,
        scopes JSONB NOT NULL,
        homepage TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL CHECK (status IN ('active', 'disabled')),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS sso_clients_owner_idx ON sso_client_applications(owner_id);
      CREATE TABLE IF NOT EXISTS sso_internal_applications (
        id UUID PRIMARY KEY,
        name VARCHAR(80) NOT NULL,
        homepage TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL CHECK (status IN ('active', 'disabled')),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS sso_login_attempts (
        account VARCHAR(64) PRIMARY KEY,
        failures INTEGER NOT NULL DEFAULT 0,
        window_started_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      ALTER TABLE sso_client_applications DROP COLUMN IF EXISTS protocol;
      ALTER TABLE sso_client_applications
        ADD COLUMN IF NOT EXISTS logo_data BYTEA,
        ADD COLUMN IF NOT EXISTS logo_mime TEXT,
        ADD COLUMN IF NOT EXISTS logo_updated_at TIMESTAMPTZ;
      CREATE TABLE IF NOT EXISTS sso_client_secrets (
        id UUID PRIMARY KEY,
        application_id UUID NOT NULL REFERENCES sso_client_applications(id) ON DELETE CASCADE,
        secret_hash CHAR(64) NOT NULL,
        secret_encrypted TEXT,
        last_four VARCHAR(4) NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        created_by UUID REFERENCES sso_users(id) ON DELETE SET NULL,
        last_used_at TIMESTAMPTZ,
        UNIQUE (application_id, secret_hash)
      );
      ALTER TABLE sso_client_secrets
        ADD COLUMN IF NOT EXISTS secret_encrypted TEXT;
      CREATE TABLE IF NOT EXISTS sso_client_authorizations (
        id UUID PRIMARY KEY,
        application_id UUID NOT NULL REFERENCES sso_client_applications(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES sso_users(id) ON DELETE CASCADE,
        scopes JSONB NOT NULL,
        authorized_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        last_used_at TIMESTAMPTZ,
        UNIQUE (application_id, user_id)
      );
      CREATE TABLE IF NOT EXISTS sso_client_tokens (
        id UUID PRIMARY KEY,
        authorization_id UUID NOT NULL REFERENCES sso_client_authorizations(id) ON DELETE CASCADE,
        token_hash CHAR(64) NOT NULL UNIQUE,
        type TEXT NOT NULL CHECK (type IN ('access', 'refresh')),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        expires_at TIMESTAMPTZ NOT NULL
      );
      CREATE INDEX IF NOT EXISTS sso_client_tokens_authorization_idx ON sso_client_tokens(authorization_id);
    `, { transaction });
    const legacySecrets = await db.query<{
      id: string; ownerId: string; secret: string; createdAt: Date;
    }>(`
      SELECT id, owner_id AS "ownerId", client_secret AS secret, created_at AS "createdAt"
      FROM sso_client_applications WHERE client_secret <> ''
    `, { transaction, type: QueryTypes.SELECT });
    for (const legacy of legacySecrets) {
      await db.query(`
        INSERT INTO sso_client_secrets
          (id, application_id, secret_hash, secret_encrypted, last_four, created_at, created_by)
        VALUES (:id, :applicationId, :hash, :secretEncrypted, :lastFour, :createdAt, :createdBy)
        ON CONFLICT (application_id, secret_hash) DO NOTHING
      `, { transaction, replacements: {
        id: randomUUID(), applicationId: legacy.id,
        hash: createHash("sha256").update(legacy.secret).digest("hex"),
        secretEncrypted: encryptClientSecret(legacy.secret),
        lastFour: legacy.secret.slice(-4), createdAt: legacy.createdAt, createdBy: legacy.ownerId,
      } });
      await db.query("UPDATE sso_client_applications SET client_secret = '' WHERE id = :id", {
        transaction, replacements: { id: legacy.id },
      });
    }
    await db.query(`
      INSERT INTO sso_users (id, login_account, username, phone, password_hash, role)
      SELECT :id, 'admin', 'admin', NULL, :passwordHash, 'admin'
      WHERE NOT EXISTS (SELECT 1 FROM sso_users WHERE login_account = 'admin')
      ON CONFLICT (login_account) DO NOTHING
    `, { replacements: { id: randomUUID(), passwordHash: adminPassword }, transaction });
  });
}

export function ensureStore() {
  if (globalStore.ssoSchemaState?.version !== schemaVersion) {
    const ready = initializeStore().catch((error: unknown) => {
      if (globalStore.ssoSchemaState?.ready === ready) globalStore.ssoSchemaState = undefined;
      throw error;
    });
    globalStore.ssoSchemaState = { version: schemaVersion, ready };
  }
  return globalStore.ssoSchemaState.ready;
}
