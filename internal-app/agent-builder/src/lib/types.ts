export type UserRole = "admin" | "user";

export type PublicUser = {
  id: string;
  username: string;
  role: UserRole;
  isBuiltIn: boolean;
  avatarUrl: string | null;
  createdAt: string;
  updatedAt: string;
};

export const MAX_AVATAR_SIZE_BYTES = 5 * 1024 * 1024;
export const ALLOWED_AVATAR_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
] as const;

export interface UsersPagePayload {
  users: PublicUser[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface ProjectFile {
  path: string;
  language: string;
  content: string;
}

export interface WorkspaceEntry {
  name: string;
  path: string;
  kind: "file" | "directory";
}

export type ChatToolStatus = "running" | "complete" | "error";

export interface ChatToolPart {
  type: "tool";
  id: string;
  command: string;
  status: ChatToolStatus;
  output: string;
  exitCode: number | null;
  background: boolean;
  previewUrl: string | null;
  startedAt?: string;
  endedAt?: string | null;
}

export interface ChatStepPart {
  type: "step";
  id: string;
  label: string;
  status: ChatToolStatus;
  startedAt: string;
  endedAt: string | null;
}

export const MAX_CHAT_IMAGES = 6;
export const MAX_CHAT_IMAGE_BYTES = 4 * 1024 * 1024;
export const VISION_IMAGE_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
] as const;

export type ChatImageInput = {
  name: string;
  mediaType: string;
  data: string;
};

export type ChatImagePart = {
  type: "image";
  id: string;
  mediaType: string;
  name: string;
  url: string;
};

export type ChatMessagePart =
  | { type: "text"; text: string }
  | ChatImagePart
  | ChatToolPart
  | ChatStepPart;

export interface ChatMessageDto {
  id: string;
  sessionId: string;
  role: "user" | "assistant";
  content: string;
  parts: ChatMessagePart[];
  modelIcon: ModelProviderIconId | null;
  artifactTitle: string | null;
  createdAt: string;
}

export interface ChatSessionSummary {
  id: string;
  projectId: string | null;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectSummary {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  sessions: ChatSessionSummary[];
}

export interface ChatSessionDetail {
  id: string;
  projectId: string | null;
  projectName: string | null;
  title: string;
  files: ProjectFile[];
  previewUrl: string | null;
  messages: ChatMessageDto[];
  createdAt: string;
  updatedAt: string;
}

export interface PreviewServerStatus {
  running: boolean;
  previewUrl: string | null;
}

export interface ProjectCommandResult {
  status: "exited" | "running";
  exitCode: number | null;
  output: string;
  processId: string | null;
  pid: number | null;
  logPath: string | null;
  previewUrl: string | null;
}

export type ModelProvider =
  | "openai-chat-completions"
  | "openai-responses"
  | "anthropic-messages";

export type ModelProviderIconId =
  | "openai"
  | "anthropic"
  | "claude"
  | "deepseek"
  | "gemini"
  | "qwen"
  | "zhipu"
  | "doubao"
  | "moonshot"
  | "minimax"
  | "openrouter"
  | "azure"
  | "bedrock"
  | "vertexai"
  | "ollama"
  | "vllm"
  | "mistral"
  | "meta"
  | "xai"
  | "groq"
  | "siliconcloud"
  | "volcengine"
  | "alibabacloud"
  | "tencentcloud"
  | "together"
  | "fireworks"
  | "perplexity"
  | "huggingface";

export interface ModelProviderOption {
  value: ModelProvider;
  label: string;
  endpointPath: string;
  defaultBaseUrl: string;
  defaultIcon: ModelProviderIconId;
  placeholderModel: string;
}

export const MODEL_PROVIDER_OPTIONS: ModelProviderOption[] = [
  {
    value: "openai-chat-completions",
    label: "OpenAI Chat Completions",
    endpointPath: "/chat/completions",
    defaultBaseUrl: "https://api.openai.com/v1",
    defaultIcon: "openai",
    placeholderModel: "gpt-4o",
  },
  {
    value: "openai-responses",
    label: "OpenAI Responses",
    endpointPath: "/responses",
    defaultBaseUrl: "https://api.openai.com/v1",
    defaultIcon: "openai",
    placeholderModel: "gpt-5",
  },
  {
    value: "anthropic-messages",
    label: "Anthropic Messages",
    endpointPath: "/v1/messages",
    defaultBaseUrl: "https://api.anthropic.com",
    defaultIcon: "anthropic",
    placeholderModel: "claude-sonnet-4-5",
  },
];

export interface ModelProviderIconOption {
  value: ModelProviderIconId;
  label: string;
}

export const MODEL_PROVIDER_ICON_OPTIONS: ModelProviderIconOption[] = [
  { value: "openai", label: "OpenAI" },
  { value: "anthropic", label: "Anthropic" },
  { value: "claude", label: "Claude" },
  { value: "deepseek", label: "DeepSeek" },
  { value: "gemini", label: "Google Gemini" },
  { value: "qwen", label: "通义千问 Qwen" },
  { value: "zhipu", label: "智谱清言" },
  { value: "doubao", label: "豆包 Doubao" },
  { value: "moonshot", label: "Moonshot / Kimi" },
  { value: "minimax", label: "MiniMax" },
  { value: "openrouter", label: "OpenRouter" },
  { value: "azure", label: "Azure OpenAI" },
  { value: "bedrock", label: "AWS Bedrock" },
  { value: "vertexai", label: "Google Vertex AI" },
  { value: "ollama", label: "Ollama" },
  { value: "vllm", label: "vLLM" },
  { value: "mistral", label: "Mistral AI" },
  { value: "meta", label: "Meta Llama" },
  { value: "xai", label: "xAI / Grok" },
  { value: "groq", label: "Groq" },
  { value: "siliconcloud", label: "硅基流动 SiliconFlow" },
  { value: "volcengine", label: "火山引擎" },
  { value: "alibabacloud", label: "阿里云百炼" },
  { value: "tencentcloud", label: "腾讯云" },
  { value: "together", label: "Together AI" },
  { value: "fireworks", label: "Fireworks AI" },
  { value: "perplexity", label: "Perplexity" },
  { value: "huggingface", label: "Hugging Face" },
];

const MODEL_PROVIDER_ICON_IDS = new Set<ModelProviderIconId>(
  MODEL_PROVIDER_ICON_OPTIONS.map((item) => item.value)
);

export function isModelProviderIcon(
  value: unknown
): value is ModelProviderIconId {
  return (
    typeof value === "string" &&
    MODEL_PROVIDER_ICON_IDS.has(value as ModelProviderIconId)
  );
}

export type ModelConfigDto = {
  id: string;
  name: string;
  provider: ModelProvider;
  icon: ModelProviderIconId;
  modelName: string;
  baseUrl: string;
  apiKeyMasked: string;
  isDefault: boolean;
  isEnabled: boolean;
  createdAt: string;
  updatedAt: string;
};

export type AvailableModelOption = {
  id: string;
  name: string;
  provider: ModelProvider;
  icon: ModelProviderIconId;
  modelName: string;
  isDefault: boolean;
};

export interface CreateModelConfigInput {
  name: string;
  provider: ModelProvider;
  icon?: ModelProviderIconId;
  modelName: string;
  baseUrl?: string;
  apiKey: string;
  isDefault?: boolean;
  isEnabled?: boolean;
}

export interface UpdateModelConfigInput {
  name?: string;
  provider?: ModelProvider;
  icon?: ModelProviderIconId;
  modelName?: string;
  baseUrl?: string;
  apiKey?: string;
  isDefault?: boolean;
  isEnabled?: boolean;
}

export const BUILT_IN_ADMIN_USERNAME = "admin";
export const BUILT_IN_ADMIN_INITIAL_PASSWORD = "admin";
export const DEFAULT_USER_PASSWORD = "user12345";
