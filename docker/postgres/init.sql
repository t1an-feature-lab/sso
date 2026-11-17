CREATE DATABASE sso_server;
CREATE DATABASE internal_app;
CREATE DATABASE external_app;

\connect external_app

CREATE TABLE IF NOT EXISTS "external-app_users" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL,
  provider_user_id TEXT NOT NULL,
  username TEXT NOT NULL,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (provider, provider_user_id)
);
