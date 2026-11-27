import "server-only";
import {
  MODEL_PROVIDER_ICON_OPTIONS,
  MODEL_PROVIDER_OPTIONS,
  type AvailableModelOption,
  type CreateModelConfigInput,
  type ModelConfigDto,
  type ModelProvider,
  type ModelProviderIconId,
  type UpdateModelConfigInput,
} from "@/lib/types";
import { db } from "./db";
import { HttpError } from "./http";

const PROVIDER_OPTION_MAP = new Map(
  MODEL_PROVIDER_OPTIONS.map((item) => [item.value, item])
);
const VALID_ICONS = new Set<string>(
  MODEL_PROVIDER_ICON_OPTIONS.map((item) => item.value)
);

function resolveLegacyProvider(rawProvider: string): ModelProvider {
  if (PROVIDER_OPTION_MAP.has(rawProvider as ModelProvider)) {
    return rawProvider as ModelProvider;
  }
  if (rawProvider === "anthropic") {
    return "anthropic-messages";
  }
  return "openai-chat-completions";
}

function resolveDefaultIcon(
  rawProvider: string,
  provider: ModelProvider
): ModelProviderIconId {
  if (rawProvider === "deepseek") return "deepseek";
  if (rawProvider === "google") return "gemini";
  if (rawProvider === "anthropic") return "anthropic";
  return PROVIDER_OPTION_MAP.get(provider)?.defaultIcon ?? "openai";
}

function normalizeProvider(value: unknown): ModelProvider {
  if (
    typeof value !== "string" ||
    !PROVIDER_OPTION_MAP.has(value as ModelProvider)
  ) {
    throw new HttpError(400, "请选择有效的协议格式");
  }
  return value as ModelProvider;
}

function normalizeIcon(
  value: unknown,
  fallbackProvider: ModelProvider
): ModelProviderIconId {
  if (value === undefined || value === null || value === "") {
    return PROVIDER_OPTION_MAP.get(fallbackProvider)?.defaultIcon ?? "openai";
  }
  if (typeof value !== "string" || !VALID_ICONS.has(value)) {
    throw new HttpError(400, "请选择有效的供应商图标");
  }
  return value as ModelProviderIconId;
}

function normalizeName(value: unknown): string {
  const trimmed = typeof value === "string" ? value.trim() : "";
  if (!trimmed) {
    throw new HttpError(400, "请输入供应商名称");
  }
  if (trimmed.length > 120) {
    throw new HttpError(400, "供应商名称不能超过 120 个字符");
  }
  return trimmed;
}

function normalizeModelName(value: unknown): string {
  const trimmed = typeof value === "string" ? value.trim() : "";
  if (!trimmed) {
    throw new HttpError(400, "请输入模型名称");
  }
  if (trimmed.length > 160) {
    throw new HttpError(400, "模型名称不能超过 160 个字符");
  }
  return trimmed;
}

function normalizeBaseUrl(value: unknown, provider: ModelProvider): string {
  const trimmed = typeof value === "string" ? value.trim() : "";
  if (!trimmed) {
    return (
      PROVIDER_OPTION_MAP.get(provider)?.defaultBaseUrl ??
      "https://api.openai.com/v1"
    );
  }
  if (trimmed.length > 500) {
    throw new HttpError(400, "Base URL 不能超过 500 个字符");
  }
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new HttpError(400, "请输入有效的 http 或 https 接口地址");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new HttpError(400, "Base URL 仅支持 http 或 https 协议");
  }
  return trimmed;
}

function normalizeApiKey(value: unknown, required: boolean): string | undefined {
  if (value === undefined || value === null) {
    if (required) throw new HttpError(400, "请输入 API Key");
    return undefined;
  }
  const trimmed = typeof value === "string" ? value.trim() : "";
  if (!trimmed) {
    if (required) throw new HttpError(400, "请输入 API Key");
    return undefined;
  }
  if (trimmed.length > 1000) {
    throw new HttpError(400, "API Key 长度超出限制");
  }
  return trimmed;
}

function maskApiKey(apiKey: string): string {
  const trimmed = apiKey.trim();
  if (trimmed.length <= 8) {
    return "••••••••";
  }
  const prefix = trimmed.slice(0, 4);
  const suffix = trimmed.slice(-4);
  return `${prefix}••••••••${suffix}`;
}

function toModelConfigDto(row: {
  id: string;
  name: string;
  provider: string;
  icon: string;
  modelName: string;
  baseUrl: string;
  apiKey: string;
  isDefault: boolean;
  isEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}): ModelConfigDto {
  const provider = resolveLegacyProvider(row.provider);
  const icon = VALID_ICONS.has(row.icon)
    ? (row.icon as ModelProviderIconId)
    : resolveDefaultIcon(row.provider, provider);

  return {
    id: row.id,
    name: row.name,
    provider,
    icon,
    modelName: row.modelName,
    baseUrl: row.baseUrl,
    apiKeyMasked: maskApiKey(row.apiKey),
    isDefault: row.isDefault,
    isEnabled: row.isEnabled,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listModelConfigs(): Promise<ModelConfigDto[]> {
  const rows = await db.modelConfig.findMany({
    orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }, { id: "asc" }],
  });
  return rows.map(toModelConfigDto);
}

function toAvailableModelOption(row: {
  id: string;
  name: string;
  provider: string;
  icon: string;
  modelName: string;
  isDefault: boolean;
}): AvailableModelOption {
  const provider = resolveLegacyProvider(row.provider);
  const icon = VALID_ICONS.has(row.icon)
    ? (row.icon as ModelProviderIconId)
    : resolveDefaultIcon(row.provider, provider);

  return {
    id: row.id,
    name: row.name,
    provider,
    icon,
    modelName: row.modelName,
    isDefault: row.isDefault,
  };
}

export async function listAvailableModels(): Promise<AvailableModelOption[]> {
  const rows = await db.modelConfig.findMany({
    where: { isEnabled: true },
    orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }, { id: "asc" }],
    select: {
      id: true,
      name: true,
      provider: true,
      icon: true,
      modelName: true,
      isDefault: true,
    },
  });
  return rows.map(toAvailableModelOption);
}

export async function setDefaultAvailableModel(
  modelId: string
): Promise<AvailableModelOption> {
  const normalizedId = typeof modelId === "string" ? modelId.trim() : "";
  if (!normalizedId) {
    throw new HttpError(400, "请选择有效的模型");
  }

  const existing = await db.modelConfig.findUnique({
    where: { id: normalizedId },
    select: {
      id: true,
      name: true,
      provider: true,
      icon: true,
      modelName: true,
      isDefault: true,
      isEnabled: true,
    },
  });
  if (!existing) {
    throw new HttpError(404, "模型配置不存在");
  }
  if (!existing.isEnabled) {
    throw new HttpError(400, "该模型已停用，无法设为默认模型");
  }

  const updated = await db.$transaction(async (tx) => {
    await tx.modelConfig.updateMany({
      where: { id: { not: normalizedId }, isDefault: true },
      data: { isDefault: false },
    });
    return tx.modelConfig.update({
      where: { id: normalizedId },
      data: { isDefault: true },
      select: {
        id: true,
        name: true,
        provider: true,
        icon: true,
        modelName: true,
        isDefault: true,
      },
    });
  });

  return toAvailableModelOption(updated);
}

export async function createModelConfig(
  input: CreateModelConfigInput
): Promise<ModelConfigDto> {
  const name = normalizeName(input.name);
  const provider = normalizeProvider(input.provider);
  const icon = normalizeIcon(input.icon, provider);
  const modelName = normalizeModelName(input.modelName);
  const baseUrl = normalizeBaseUrl(input.baseUrl, provider);
  const apiKey = normalizeApiKey(input.apiKey, true)!;
  const isDefault = Boolean(input.isDefault);
  const isEnabled = isDefault ? true : input.isEnabled ?? true;

  const created = await db.$transaction(async (tx) => {
    if (isDefault) {
      await tx.modelConfig.updateMany({
        where: { isDefault: true },
        data: { isDefault: false },
      });
    }
    return tx.modelConfig.create({
      data: {
        name,
        provider,
        icon,
        modelName,
        baseUrl,
        apiKey,
        isDefault,
        isEnabled,
      },
    });
  });

  return toModelConfigDto(created);
}

export async function updateModelConfig(
  modelId: string,
  input: UpdateModelConfigInput
): Promise<ModelConfigDto> {
  const existing = await db.modelConfig.findUnique({ where: { id: modelId } });
  if (!existing) {
    throw new HttpError(404, "模型配置不存在");
  }

  const nextProvider =
    input.provider !== undefined
      ? normalizeProvider(input.provider)
      : resolveLegacyProvider(existing.provider);

  const data: {
    name?: string;
    provider?: ModelProvider;
    icon?: ModelProviderIconId;
    modelName?: string;
    baseUrl?: string;
    apiKey?: string;
    isDefault?: boolean;
    isEnabled?: boolean;
  } = {};

  if (input.name !== undefined) data.name = normalizeName(input.name);
  if (input.provider !== undefined) {
    data.provider = nextProvider;
  }
  if (input.icon !== undefined) {
    data.icon = normalizeIcon(input.icon, nextProvider);
  }
  if (input.modelName !== undefined) {
    data.modelName = normalizeModelName(input.modelName);
  }
  if (input.baseUrl !== undefined) {
    data.baseUrl = normalizeBaseUrl(input.baseUrl, nextProvider);
  }
  const nextApiKey = normalizeApiKey(input.apiKey, false);
  if (nextApiKey !== undefined) {
    data.apiKey = nextApiKey;
  }

  let nextEnabled =
    input.isEnabled !== undefined ? Boolean(input.isEnabled) : existing.isEnabled;
  let nextDefault =
    input.isDefault !== undefined ? Boolean(input.isDefault) : existing.isDefault;

  if (input.isDefault === true) {
    nextEnabled = true;
    nextDefault = true;
  } else if (!nextEnabled) {
    nextDefault = false;
  }

  if (input.isEnabled !== undefined || input.isDefault !== undefined) {
    data.isEnabled = nextEnabled;
    data.isDefault = nextDefault;
  }

  const updated = await db.$transaction(async (tx) => {
    if (data.isDefault === true) {
      await tx.modelConfig.updateMany({
        where: { id: { not: modelId }, isDefault: true },
        data: { isDefault: false },
      });
    }
    return tx.modelConfig.update({
      where: { id: modelId },
      data,
    });
  });

  return toModelConfigDto(updated);
}

export async function deleteModelConfig(modelId: string): Promise<void> {
  const existing = await db.modelConfig.findUnique({ where: { id: modelId } });
  if (!existing) {
    throw new HttpError(404, "模型配置不存在");
  }
  await db.modelConfig.delete({ where: { id: modelId } });
}

export async function getModelConfigApiKey(modelId: string): Promise<string> {
  const existing = await db.modelConfig.findUnique({
    where: { id: modelId },
    select: { apiKey: true },
  });
  if (!existing) {
    throw new HttpError(404, "模型配置不存在");
  }
  return existing.apiKey;
}
