-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "user_role" AS ENUM ('admin', 'user');

-- CreateEnum
CREATE TYPE "application_status" AS ENUM ('active', 'disabled');

-- CreateEnum
CREATE TYPE "token_type" AS ENUM ('access', 'refresh');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "login_account" VARCHAR(64) NOT NULL,
    "username" VARCHAR(64) NOT NULL,
    "phone" VARCHAR(20),
    "password_hash" TEXT NOT NULL,
    "role" "user_role" NOT NULL DEFAULT 'user',
    "avatar_data" BYTEA,
    "avatar_mime" TEXT,
    "avatar_updated_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "token_hash" CHAR(64) NOT NULL,
    "user_id" UUID NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("token_hash")
);

-- CreateTable
CREATE TABLE "applications" (
    "id" UUID NOT NULL,
    "owner_id" UUID NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "client_id" TEXT NOT NULL,
    "redirect_uris" TEXT[],
    "scopes" TEXT[] DEFAULT ARRAY['openid', 'profile', 'email']::TEXT[],
    "homepage" TEXT NOT NULL,
    "status" "application_status" NOT NULL DEFAULT 'active',
    "logo_data" BYTEA,
    "logo_mime" TEXT,
    "logo_updated_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_secrets" (
    "id" UUID NOT NULL,
    "application_id" UUID NOT NULL,
    "secret_hash" CHAR(64) NOT NULL,
    "secret_encrypted" TEXT NOT NULL,
    "last_four" VARCHAR(4) NOT NULL,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_used_at" TIMESTAMPTZ(3),

    CONSTRAINT "client_secrets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_application_authorizations" (
    "id" UUID NOT NULL,
    "application_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "scopes" TEXT[],
    "authorized_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_used_at" TIMESTAMPTZ(3),

    CONSTRAINT "user_application_authorizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "application_tokens" (
    "id" UUID NOT NULL,
    "authorization_id" UUID NOT NULL,
    "token_hash" CHAR(64) NOT NULL,
    "type" "token_type" NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "application_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_login_account_key" ON "users"("login_account");

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone");

-- CreateIndex
CREATE INDEX "sessions_user_id_idx" ON "sessions"("user_id");

-- CreateIndex
CREATE INDEX "sessions_expires_at_idx" ON "sessions"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "applications_client_id_key" ON "applications"("client_id");

-- CreateIndex
CREATE INDEX "applications_owner_id_idx" ON "applications"("owner_id");

-- CreateIndex
CREATE INDEX "client_secrets_created_by_idx" ON "client_secrets"("created_by");

-- CreateIndex
CREATE UNIQUE INDEX "client_secrets_application_id_secret_hash_key" ON "client_secrets"("application_id", "secret_hash");

-- CreateIndex
CREATE INDEX "user_application_authorizations_user_id_idx" ON "user_application_authorizations"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_application_authorizations_application_id_user_id_key" ON "user_application_authorizations"("application_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "application_tokens_token_hash_key" ON "application_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "application_tokens_authorization_id_idx" ON "application_tokens"("authorization_id");

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applications" ADD CONSTRAINT "applications_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_secrets" ADD CONSTRAINT "client_secrets_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_secrets" ADD CONSTRAINT "client_secrets_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_application_authorizations" ADD CONSTRAINT "user_application_authorizations_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_application_authorizations" ADD CONSTRAINT "user_application_authorizations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_tokens" ADD CONSTRAINT "application_tokens_authorization_id_fkey" FOREIGN KEY ("authorization_id") REFERENCES "user_application_authorizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

