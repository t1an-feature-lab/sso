"use client";

import { useId, useRef, useState } from "react";
import { AlertDialog } from "@astryxdesign/core/AlertDialog";
import { Badge } from "@astryxdesign/core/Badge";
import { Button } from "@astryxdesign/core/Button";
import { Card } from "@astryxdesign/core/Card";
import { Dialog, DialogHeader } from "@astryxdesign/core/Dialog";
import { Divider } from "@astryxdesign/core/Divider";
import {
  DropdownMenu,
  DropdownMenuDivider,
  DropdownMenuItem,
} from "@astryxdesign/core/DropdownMenu";
import { EmptyState } from "@astryxdesign/core/EmptyState";
import { FormLayout } from "@astryxdesign/core/FormLayout";
import { Icon } from "@astryxdesign/core/Icon";
import { Layout, LayoutContent, LayoutFooter } from "@astryxdesign/core/Layout";
import { Selector } from "@astryxdesign/core/Selector";
import { HStack, StackItem, VStack } from "@astryxdesign/core/Stack";
import { Switch } from "@astryxdesign/core/Switch";
import { Text } from "@astryxdesign/core/Text";
import { TextInput } from "@astryxdesign/core/TextInput";
import {
  CheckIcon,
  ClipboardDocumentIcon,
  EyeIcon,
  EyeSlashIcon,
  PencilSquareIcon,
  PlusIcon,
  StarIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";
import { useAppToast } from "@/components/app-toast";
import { ModelProviderIcon } from "@/components/model-provider-icon";
import { RobotIcon } from "@/components/robot-icon";
import { WorkspaceHeader } from "@/components/workspace-header";
import { apiClient } from "@/lib/api-client";
import "./model-config-view.css";
import {
  MODEL_PROVIDER_ICON_OPTIONS,
  MODEL_PROVIDER_OPTIONS,
  type CreateModelConfigInput,
  type ModelConfigDto,
  type ModelProvider,
  type ModelProviderIconId,
  type UpdateModelConfigInput,
} from "@/lib/types";

const PROVIDER_MAP = Object.fromEntries(
  MODEL_PROVIDER_OPTIONS.map((item) => [item.value, item])
) as Record<ModelProvider, (typeof MODEL_PROVIDER_OPTIONS)[number]>;

const ICON_SET = new Set<string>(
  MODEL_PROVIDER_ICON_OPTIONS.map((item) => item.value)
);

const PROVIDER_SELECTOR_OPTIONS = MODEL_PROVIDER_OPTIONS.map((item) => ({
  value: item.value,
  label: item.label,
  description: `POST ${item.endpointPath}`,
  icon: <ModelProviderIcon icon={item.defaultIcon} size={16} />,
}));

const ICON_SELECTOR_OPTIONS = MODEL_PROVIDER_ICON_OPTIONS.map((item) => ({
  value: item.value,
  label: item.label,
  icon: <ModelProviderIcon icon={item.value} size={16} />,
}));

type FormFieldKey = "name" | "modelName" | "baseUrl" | "apiKey";
type FieldErrors = Partial<Record<FormFieldKey, string>>;

function sortModels(models: ModelConfigDto[]): ModelConfigDto[] {
  return [...models].sort((a, b) => {
    if (a.isDefault !== b.isDefault) return a.isDefault ? -1 : 1;
    if (a.createdAt !== b.createdAt) {
      return a.createdAt < b.createdAt ? 1 : -1;
    }
    return a.id.localeCompare(b.id);
  });
}

function validateField(
  field: FormFieldKey,
  value: string,
  mode: "create" | "edit"
): string | undefined {
  const trimmed = value.trim();
  if (field === "name") {
    if (!trimmed) return "请输入供应商名称";
    if (trimmed.length > 120) return "供应商名称不能超过 120 个字符";
    return undefined;
  }
  if (field === "modelName") {
    if (!trimmed) return "请输入模型名称";
    if (trimmed.length > 160) return "模型名称不能超过 160 个字符";
    return undefined;
  }
  if (field === "baseUrl") {
    if (!trimmed) return undefined;
    if (trimmed.length > 500) return "Base URL 不能超过 500 个字符";
    try {
      const parsed = new URL(trimmed);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        return "Base URL 仅支持 http 或 https 协议";
      }
    } catch {
      return "请输入有效的 http 或 https 接口地址";
    }
    return undefined;
  }
  if (field === "apiKey") {
    if (mode === "create" && !trimmed) return "请输入 API Key";
    if (trimmed.length > 1000) return "API Key 长度超出限制";
    return undefined;
  }
  return undefined;
}

function ModelConfigDialog({
  mode,
  initialModel,
  defaultAsDefault,
  onClose,
  onSave,
}: {
  mode: "create" | "edit";
  initialModel?: ModelConfigDto;
  defaultAsDefault: boolean;
  onClose: () => void;
  onSave: (
    payload: CreateModelConfigInput | UpdateModelConfigInput
  ) => Promise<void>;
}) {
  const formId = useId();
  const initialProvider: ModelProvider =
    initialModel?.provider ?? "openai-chat-completions";
  const [name, setName] = useState(initialModel?.name ?? "");
  const [provider, setProvider] = useState<ModelProvider>(initialProvider);
  const [icon, setIcon] = useState<ModelProviderIconId>(
    initialModel?.icon ?? PROVIDER_MAP[initialProvider].defaultIcon
  );
  const [modelName, setModelName] = useState(initialModel?.modelName ?? "");
  const [baseUrl, setBaseUrl] = useState(initialModel?.baseUrl ?? "");
  const [apiKey, setApiKey] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);
  const [isEnabled, setIsEnabled] = useState(initialModel?.isEnabled ?? true);
  const [isDefault, setIsDefault] = useState(
    initialModel?.isDefault ?? defaultAsDefault
  );
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);

  const nameRef = useRef<HTMLInputElement>(null);
  const modelNameRef = useRef<HTMLInputElement>(null);
  const baseUrlRef = useRef<HTMLInputElement>(null);
  const apiKeyRef = useRef<HTMLInputElement>(null);
  const dirtyFieldsRef = useRef<Set<FormFieldKey>>(new Set());
  const customIconSelectedRef = useRef<boolean>(mode === "edit");

  const currentProviderOption = PROVIDER_MAP[provider];

  function handleProviderChange(nextValue: string) {
    if (!(nextValue in PROVIDER_MAP)) return;
    const nextProvider = nextValue as ModelProvider;
    const prevDefaultIcon = PROVIDER_MAP[provider].defaultIcon;
    const prevDefaultUrl = PROVIDER_MAP[provider].defaultBaseUrl;
    setProvider(nextProvider);

    if (
      !customIconSelectedRef.current ||
      icon === prevDefaultIcon
    ) {
      setIcon(PROVIDER_MAP[nextProvider].defaultIcon);
    }

    if (
      mode === "create" &&
      baseUrl.trim() === prevDefaultUrl
    ) {
      setBaseUrl("");
      setErrors((prev) => ({ ...prev, baseUrl: undefined }));
    }
  }

  function handleIconChange(nextValue: string) {
    if (!ICON_SET.has(nextValue)) return;
    customIconSelectedRef.current = true;
    setIcon(nextValue as ModelProviderIconId);
  }

  function handleFieldChange(field: FormFieldKey, nextValue: string) {
    dirtyFieldsRef.current.add(field);
    if (field === "name") setName(nextValue);
    if (field === "modelName") setModelName(nextValue);
    if (field === "baseUrl") setBaseUrl(nextValue);
    if (field === "apiKey") setApiKey(nextValue);
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  }

  function handleFieldBlur(field: FormFieldKey, value: string) {
    if (!dirtyFieldsRef.current.has(field)) return;
    const message = validateField(field, value, mode);
    setErrors((prev) => ({ ...prev, [field]: message }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    const nextErrors: FieldErrors = {
      name: validateField("name", name, mode),
      modelName: validateField("modelName", modelName, mode),
      baseUrl: validateField("baseUrl", baseUrl, mode),
      apiKey: validateField("apiKey", apiKey, mode),
    };
    setErrors(nextErrors);

    const orderedFields: {
      key: FormFieldKey;
      ref: React.RefObject<HTMLInputElement | null>;
    }[] = [
      { key: "name", ref: nameRef },
      { key: "modelName", ref: modelNameRef },
      { key: "baseUrl", ref: baseUrlRef },
      { key: "apiKey", ref: apiKeyRef },
    ];
    const firstInvalid = orderedFields.find(({ key }) =>
      Boolean(nextErrors[key])
    );
    if (firstInvalid) {
      firstInvalid.ref.current?.focus();
      return;
    }

    const resolvedBaseUrl =
      baseUrl.trim() || currentProviderOption.defaultBaseUrl;

    setSubmitting(true);
    try {
      if (mode === "create") {
        await onSave({
          name: name.trim(),
          provider,
          icon,
          modelName: modelName.trim(),
          baseUrl: resolvedBaseUrl,
          apiKey: apiKey.trim(),
          isEnabled,
          isDefault: isEnabled ? isDefault : false,
        });
      } else {
        const updatePayload: UpdateModelConfigInput = {
          name: name.trim(),
          provider,
          icon,
          modelName: modelName.trim(),
          baseUrl: resolvedBaseUrl,
          isEnabled,
          isDefault: isEnabled ? isDefault : false,
        };
        if (apiKey.trim()) {
          updatePayload.apiKey = apiKey.trim();
        }
        await onSave(updatePayload);
      }
      onClose();
    } catch {
      // Caller reports error via toast; keep dialog open so user can adjust
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog
      isOpen
      onOpenChange={(open) => {
        if (!open && !submitting) onClose();
      }}
      purpose="form"
      width={540}
    >
      <Layout
        header={
          <DialogHeader
            title={mode === "edit" ? "编辑模型供应商" : "新增模型供应商"}
            hasDivider
            onOpenChange={(open) => {
              if (!open && !submitting) onClose();
            }}
          />
        }
        content={
          <LayoutContent>
            <form
              id={formId}
              noValidate
              onSubmit={(event) => void handleSubmit(event)}
            >
              <FormLayout>
                <TextInput
                  ref={nameRef}
                  label="供应商名称"
                  htmlName="name"
                  value={name}
                  onChange={(value) => handleFieldChange("name", value)}
                  onBlur={() => handleFieldBlur("name", name)}
                  placeholder="例如：OpenAI 官方"
                  autoComplete="off"
                  isRequired
                  isDisabled={submitting}
                  status={
                    errors.name
                      ? { type: "error", message: errors.name }
                      : undefined
                  }
                />

                <Selector
                  label="协议格式"
                  htmlName="provider"
                  value={provider}
                  onChange={handleProviderChange}
                  options={PROVIDER_SELECTOR_OPTIONS}
                  startIcon={
                    <ModelProviderIcon
                      icon={currentProviderOption.defaultIcon}
                      size={16}
                    />
                  }
                  isRequired
                  isDisabled={submitting}
                  width="100%"
                />

                <Selector
                  label="供应商图标"
                  htmlName="icon"
                  value={icon}
                  onChange={handleIconChange}
                  options={ICON_SELECTOR_OPTIONS}
                  startIcon={<ModelProviderIcon icon={icon} size={16} />}
                  hasSearch
                  searchPlaceholder="搜索图标"
                  emptySearchText="未找到匹配的图标"
                  isRequired
                  isDisabled={submitting}
                  width="100%"
                />

                <TextInput
                  ref={modelNameRef}
                  label="模型名称"
                  htmlName="modelName"
                  value={modelName}
                  onChange={(value) => handleFieldChange("modelName", value)}
                  onBlur={() => handleFieldBlur("modelName", modelName)}
                  placeholder={currentProviderOption.placeholderModel}
                  autoComplete="off"
                  autoCapitalize="none"
                  hasAutoCorrect={false}
                  hasSpellCheck={false}
                  isRequired
                  isDisabled={submitting}
                  status={
                    errors.modelName
                      ? { type: "error", message: errors.modelName }
                      : undefined
                  }
                />

                <TextInput
                  ref={baseUrlRef}
                  label="Base URL"
                  htmlName="baseUrl"
                  type="url"
                  value={baseUrl}
                  onChange={(value) => handleFieldChange("baseUrl", value)}
                  onBlur={() => handleFieldBlur("baseUrl", baseUrl)}
                  placeholder={currentProviderOption.defaultBaseUrl}
                  description={`留空默认使用 ${currentProviderOption.defaultBaseUrl}`}
                  autoComplete="off"
                  autoCapitalize="none"
                  hasAutoCorrect={false}
                  hasSpellCheck={false}
                  isOptional
                  isDisabled={submitting}
                  status={
                    errors.baseUrl
                      ? { type: "error", message: errors.baseUrl }
                      : undefined
                  }
                />

                <HStack gap={2} vAlign="end" width="100%">
                  <StackItem size="fill">
                    <TextInput
                      ref={apiKeyRef}
                      label="API Key"
                      htmlName="apiKey"
                      type={showApiKey ? "text" : "password"}
                      value={apiKey}
                      onChange={(value) => handleFieldChange("apiKey", value)}
                      onBlur={() => handleFieldBlur("apiKey", apiKey)}
                      placeholder={
                        mode === "edit"
                          ? "输入新的 API Key 以替换"
                          : "输入 API Key"
                      }
                      description={
                        mode === "edit"
                          ? "留空则保留当前已保存的 API Key"
                          : undefined
                      }
                      autoComplete="new-password"
                      autoCapitalize="none"
                      hasAutoCorrect={false}
                      hasSpellCheck={false}
                      isRequired={mode === "create"}
                      isOptional={mode === "edit"}
                      isDisabled={submitting}
                      status={
                        errors.apiKey
                          ? { type: "error", message: errors.apiKey }
                          : undefined
                      }
                    />
                  </StackItem>
                  <Button
                    type="button"
                    variant="secondary"
                    size="md"
                    isIconOnly
                    icon={
                      <Icon
                        icon={showApiKey ? EyeSlashIcon : EyeIcon}
                        size="sm"
                      />
                    }
                    label={showApiKey ? "隐藏 API Key" : "显示 API Key"}
                    aria-pressed={showApiKey}
                    isDisabled={submitting}
                    onClick={() => setShowApiKey((prev) => !prev)}
                  />
                </HStack>

                <Switch
                  label="启用该模型"
                  description="停用后该配置不会作为默认模型参与对话"
                  htmlName="isEnabled"
                  labelPosition="start"
                  labelSpacing="spread"
                  width="100%"
                  value={isEnabled}
                  isDisabled={submitting}
                  onChange={(checked) => {
                    setIsEnabled(checked);
                    if (!checked) setIsDefault(false);
                  }}
                />

                <Switch
                  label="设为默认模型"
                  description="同一时间仅允许一个默认模型配置"
                  htmlName="isDefault"
                  labelPosition="start"
                  labelSpacing="spread"
                  width="100%"
                  value={isEnabled ? isDefault : false}
                  isDisabled={submitting || !isEnabled}
                  disabledMessage="启用该模型后才能设为默认"
                  onChange={setIsDefault}
                />
              </FormLayout>
            </form>
          </LayoutContent>
        }
        footer={
          <LayoutFooter>
            <HStack gap={2} hAlign="end">
              <Button
                type="button"
                label="取消"
                variant="secondary"
                isDisabled={submitting}
                onClick={onClose}
              />
              <Button
                type="submit"
                form={formId}
                label={mode === "edit" ? "保存更改" : "保存配置"}
                variant="primary"
                isLoading={submitting}
              />
            </HStack>
          </LayoutFooter>
        }
      />
    </Dialog>
  );
}

export function ModelConfigView({
  initialModels,
}: {
  initialModels: ModelConfigDto[];
}) {
  const toast = useAppToast();
  const [models, setModels] = useState<ModelConfigDto[]>(() =>
    sortModels(initialModels)
  );
  const [dialogState, setDialogState] = useState<
    | { mode: "create"; nonce: number }
    | { mode: "edit"; model: ModelConfigDto; nonce: number }
    | null
  >(null);
  const dialogNonceRef = useRef(0);

  const [deletingModel, setDeletingModel] = useState<ModelConfigDto | null>(
    null
  );
  const [deletingPending, setDeletingPending] = useState(false);
  const [busyModelId, setBusyModelId] = useState<string | null>(null);
  const [revealedKeys, setRevealedKeys] = useState<Record<string, string>>({});
  const [revealingKeyId, setRevealingKeyId] = useState<string | null>(null);
  const [copiedKeyId, setCopiedKeyId] = useState<string | null>(null);

  function openCreateDialog() {
    dialogNonceRef.current += 1;
    setDialogState({ mode: "create", nonce: dialogNonceRef.current });
  }

  function openEditDialog(model: ModelConfigDto) {
    dialogNonceRef.current += 1;
    setDialogState({ mode: "edit", model, nonce: dialogNonceRef.current });
  }

  async function handleSaveDialog(
    payload: CreateModelConfigInput | UpdateModelConfigInput
  ) {
    if (!dialogState) return;
    try {
      if (dialogState.mode === "create") {
        const { model } = await apiClient.createModelConfig(
          payload as CreateModelConfigInput
        );
        setModels((prev) =>
          sortModels([
            model,
            ...prev.map((item) =>
              model.isDefault ? { ...item, isDefault: false } : item
            ),
          ])
        );
        toast({
          body: `已新增模型供应商「${model.name}」`,
          uniqueID: `model-create-${model.id}`,
        });
      } else {
        const { model } = await apiClient.updateModelConfig(
          dialogState.model.id,
          payload as UpdateModelConfigInput
        );
        setModels((prev) =>
          sortModels(
            prev.map((item) => {
              if (item.id === model.id) return model;
              return model.isDefault ? { ...item, isDefault: false } : item;
            })
          )
        );
        if (payload.apiKey) {
          setRevealedKeys((prev) => {
            if (!(model.id in prev)) return prev;
            const next = { ...prev };
            delete next[model.id];
            return next;
          });
        }
        toast({
          body: `已更新模型供应商「${model.name}」`,
          uniqueID: `model-update-${model.id}`,
        });
      }
    } catch (error) {
      toast({
        body:
          error instanceof Error
            ? error.message
            : dialogState.mode === "create"
              ? "新增模型供应商失败"
              : "更新模型供应商失败",
        type: "error",
        uniqueID: "model-save-err",
      });
      throw error;
    }
  }

  async function handleToggleEnabled(
    target: ModelConfigDto,
    nextEnabled: boolean
  ) {
    if (busyModelId) return;
    setBusyModelId(target.id);
    try {
      const { model } = await apiClient.updateModelConfig(target.id, {
        isEnabled: nextEnabled,
      });
      setModels((prev) =>
        sortModels(prev.map((item) => (item.id === model.id ? model : item)))
      );
      toast({
        body: nextEnabled
          ? `已启用「${model.name}」`
          : `已停用「${model.name}」`,
        uniqueID: `model-toggle-${model.id}`,
      });
    } catch (error) {
      toast({
        body: error instanceof Error ? error.message : "更新模型状态失败",
        type: "error",
        uniqueID: `model-toggle-err-${target.id}`,
      });
    } finally {
      setBusyModelId(null);
    }
  }

  async function handleSetDefault(target: ModelConfigDto) {
    if (busyModelId || target.isDefault) return;
    setBusyModelId(target.id);
    try {
      const { model } = await apiClient.updateModelConfig(target.id, {
        isDefault: true,
        isEnabled: true,
      });
      setModels((prev) =>
        sortModels(
          prev.map((item) =>
            item.id === model.id ? model : { ...item, isDefault: false }
          )
        )
      );
      toast({
        body: `已将「${model.name}」设为默认模型`,
        uniqueID: `model-default-${model.id}`,
      });
    } catch (error) {
      toast({
        body: error instanceof Error ? error.message : "设置默认模型失败",
        type: "error",
        uniqueID: `model-default-err-${target.id}`,
      });
    } finally {
      setBusyModelId(null);
    }
  }

  async function handleConfirmDelete() {
    if (!deletingModel || deletingPending) return;
    const target = deletingModel;
    setDeletingPending(true);
    try {
      await apiClient.deleteModelConfig(target.id);
      setModels((prev) => prev.filter((item) => item.id !== target.id));
      setRevealedKeys((prev) => {
        if (!(target.id in prev)) return prev;
        const next = { ...prev };
        delete next[target.id];
        return next;
      });
      setDeletingModel(null);
      toast({
        body: `已删除模型供应商「${target.name}」`,
        uniqueID: `model-delete-${target.id}`,
      });
    } catch (error) {
      toast({
        body: error instanceof Error ? error.message : "删除模型供应商失败",
        type: "error",
        uniqueID: `model-delete-err-${target.id}`,
      });
    } finally {
      setDeletingPending(false);
    }
  }

  async function handleToggleRevealKey(model: ModelConfigDto) {
    if (model.id in revealedKeys) {
      setRevealedKeys((prev) => {
        const next = { ...prev };
        delete next[model.id];
        return next;
      });
      return;
    }
    if (revealingKeyId) return;
    setRevealingKeyId(model.id);
    try {
      const { apiKey } = await apiClient.revealModelConfigApiKey(model.id);
      setRevealedKeys((prev) => ({ ...prev, [model.id]: apiKey }));
    } catch (error) {
      toast({
        body: error instanceof Error ? error.message : "获取 API Key 失败",
        type: "error",
        uniqueID: `model-key-err-${model.id}`,
      });
    } finally {
      setRevealingKeyId(null);
    }
  }

  async function handleCopyKey(model: ModelConfigDto) {
    try {
      let secret = revealedKeys[model.id];
      if (!secret) {
        const res = await apiClient.revealModelConfigApiKey(model.id);
        secret = res.apiKey;
      }
      await navigator.clipboard.writeText(secret);
      setCopiedKeyId(model.id);
      toast({
        body: "已复制 API Key",
        uniqueID: `model-copy-${model.id}`,
      });
      setTimeout(() => {
        setCopiedKeyId((current) => (current === model.id ? null : current));
      }, 2000);
    } catch (error) {
      toast({
        body: error instanceof Error ? error.message : "复制 API Key 失败",
        type: "error",
        uniqueID: `model-copy-err-${model.id}`,
      });
    }
  }

  return (
    <Layout
      height="fill"
      header={<WorkspaceHeader title="模型配置" />}
      content={
        <LayoutContent>
          <VStack gap={4} className="model-config-container">
            <HStack hAlign="start" vAlign="center">
              <Button
                label="新增模型供应商"
                variant="primary"
                size="md"
                icon={<Icon icon={PlusIcon} size="sm" />}
                onClick={openCreateDialog}
              />
            </HStack>

            {models.length === 0 ? (
              <div className="model-empty-container">
                <EmptyState
                  title="暂无模型供应商"
                  description="支持 OpenAI Chat Completions、OpenAI Responses 与 Anthropic Messages 格式，点击左上角新增模型供应商即可开始配置"
                  icon={<Icon icon={RobotIcon} size="lg" />}
                />
              </div>
            ) : (
              <ul className="model-provider-list" aria-label="模型供应商列表">
                {models.map((model) => {
                  const revealed = revealedKeys[model.id];
                  const isRevealed = revealed !== undefined;
                  const isLoadingKey = revealingKeyId === model.id;
                  const isCopied = copiedKeyId === model.id;
                  const rowBusy = busyModelId !== null || deletingPending;
                  const providerLabel =
                    PROVIDER_MAP[model.provider]?.label ?? model.provider;

                  return (
                    <li key={model.id}>
                      <Card variant="muted" padding={4}>
                        <article
                          className="model-provider-card"
                          data-disabled={!model.isEnabled || undefined}
                          aria-label={model.name}
                        >
                          <header className="model-provider-card__header">
                            <div className="model-provider-card__identity">
                              <ModelProviderIcon
                                icon={model.icon}
                                size={22}
                                framed
                                frameSize={42}
                              />
                              <div className="model-provider-card__title-group">
                                <div className="model-provider-card__title-row">
                                  <Text
                                    as="h3"
                                    type="label"
                                    weight="semibold"
                                    maxLines={1}
                                    style={{
                                      minInlineSize: 0,
                                      maxInlineSize: "18rem",
                                    }}
                                  >
                                    {model.name}
                                  </Text>
                                  {model.isDefault && (
                                    <Badge label="默认" variant="blue" />
                                  )}
                                  {!model.isEnabled && (
                                    <Badge label="已停用" variant="neutral" />
                                  )}
                                </div>
                                <div className="model-provider-card__subtitle-row">
                                  <Badge
                                    label={providerLabel}
                                    variant="neutral"
                                  />
                                  <Text
                                    type="supporting"
                                    color="secondary"
                                    maxLines={1}
                                    style={{
                                      minInlineSize: 0,
                                      maxInlineSize: "20rem",
                                      fontFamily:
                                        "var(--font-family-mono, ui-monospace, SFMono-Regular, Menlo, monospace)",
                                    }}
                                  >
                                    {model.modelName}
                                  </Text>
                                </div>
                              </div>
                            </div>

                            <div className="model-provider-card__actions">
                              <Switch
                                label={`${model.name} 启用状态`}
                                isLabelHidden
                                size="sm"
                                value={model.isEnabled}
                                isLoading={busyModelId === model.id}
                                isDisabled={
                                  busyModelId !== null &&
                                  busyModelId !== model.id
                                }
                                onChange={(checked) =>
                                  void handleToggleEnabled(model, checked)
                                }
                              />
                              <Button
                                type="button"
                                label="编辑"
                                variant="secondary"
                                size="sm"
                                icon={<Icon icon={PencilSquareIcon} size="sm" />}
                                isDisabled={rowBusy}
                                onClick={() => openEditDialog(model)}
                              />
                              <DropdownMenu
                                button={{
                                  label: `更多操作 ${model.name}`,
                                  icon: <Icon icon="moreHorizontal" />,
                                  isIconOnly: true,
                                  variant: "ghost",
                                  size: "sm",
                                  isDisabled: rowBusy,
                                }}
                                hasChevron={false}
                                alignment="end"
                                menuWidth={168}
                              >
                                {!model.isDefault && (
                                  <>
                                    <DropdownMenuItem
                                      label="设为默认"
                                      icon={StarIcon}
                                      isDisabled={!model.isEnabled || rowBusy}
                                      onClick={() =>
                                        void handleSetDefault(model)
                                      }
                                    />
                                    <DropdownMenuDivider />
                                  </>
                                )}
                                <DropdownMenuItem
                                  label="删除"
                                  icon={TrashIcon}
                                  variant="destructive"
                                  isDisabled={rowBusy}
                                  onClick={() => setDeletingModel(model)}
                                />
                              </DropdownMenu>
                            </div>
                          </header>

                          <Divider />

                          <div className="model-provider-card__meta">
                            <div className="model-provider-card__meta-item">
                              <Text
                                type="supporting"
                                color="secondary"
                                className="model-provider-card__meta-label"
                              >
                                Base URL
                              </Text>
                              <Text
                                type="supporting"
                                maxLines={1}
                                className="model-provider-card__meta-value"
                              >
                                {model.baseUrl}
                              </Text>
                            </div>

                            <div className="model-provider-card__meta-item">
                              <Text
                                type="supporting"
                                color="secondary"
                                className="model-provider-card__meta-label"
                              >
                                API Key
                              </Text>
                              <Text
                                type="supporting"
                                color="secondary"
                                maxLines={1}
                                className="model-provider-card__meta-value"
                              >
                                {isRevealed ? revealed : model.apiKeyMasked}
                              </Text>
                              <div className="model-provider-card__key-actions">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  isIconOnly
                                  isLoading={isLoadingKey}
                                  aria-pressed={isRevealed}
                                  label={
                                    isRevealed
                                      ? `隐藏 ${model.name} 的 API Key`
                                      : `查看 ${model.name} 的 API Key`
                                  }
                                  icon={
                                    <Icon
                                      icon={isRevealed ? EyeSlashIcon : EyeIcon}
                                      size="sm"
                                    />
                                  }
                                  onClick={() =>
                                    void handleToggleRevealKey(model)
                                  }
                                />
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  isIconOnly
                                  label={`复制 ${model.name} 的 API Key`}
                                  icon={
                                    <Icon
                                      icon={
                                        isCopied
                                          ? CheckIcon
                                          : ClipboardDocumentIcon
                                      }
                                      size="sm"
                                    />
                                  }
                                  onClick={() => void handleCopyKey(model)}
                                />
                              </div>
                            </div>
                          </div>
                        </article>
                      </Card>
                    </li>
                  );
                })}
              </ul>
            )}
          </VStack>

          {dialogState && (
            <ModelConfigDialog
              key={
                dialogState.mode === "edit"
                  ? `edit-${dialogState.model.id}-${dialogState.nonce}`
                  : `create-${dialogState.nonce}`
              }
              mode={dialogState.mode}
              initialModel={
                dialogState.mode === "edit" ? dialogState.model : undefined
              }
              defaultAsDefault={models.length === 0}
              onClose={() => setDialogState(null)}
              onSave={handleSaveDialog}
            />
          )}

          <AlertDialog
            isOpen={deletingModel !== null}
            onOpenChange={(open) => {
              if (!deletingPending && !open) setDeletingModel(null);
            }}
            title={`删除模型供应商「${deletingModel?.name ?? ""}」？`}
            description="删除后该模型供应商配置将被永久移除且无法恢复"
            actionLabel="删除"
            cancelLabel="取消"
            onAction={() => void handleConfirmDelete()}
            isActionLoading={deletingPending}
          />
        </LayoutContent>
      }
    />
  );
}
