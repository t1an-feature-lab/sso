"use client";

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { AlertDialog } from "@astryxdesign/core/AlertDialog";
import { Avatar } from "@astryxdesign/core/Avatar";
import { Badge } from "@astryxdesign/core/Badge";
import { Button } from "@astryxdesign/core/Button";
import { Card } from "@astryxdesign/core/Card";
import { CheckboxList, CheckboxListItem } from "@astryxdesign/core/CheckboxList";
import { Dialog, DialogHeader } from "@astryxdesign/core/Dialog";
import { Divider } from "@astryxdesign/core/Divider";
import { EmptyState } from "@astryxdesign/core/EmptyState";
import { FormLayout } from "@astryxdesign/core/FormLayout";
import { Icon } from "@astryxdesign/core/Icon";
import {
  HStack,
  Layout,
  LayoutContent,
  LayoutFooter,
  LayoutPanel,
  StackItem,
  VStack,
} from "@astryxdesign/core/Layout";
import { List, ListItem } from "@astryxdesign/core/List";
import { MoreMenu } from "@astryxdesign/core/MoreMenu";
import { RadioList, RadioListItem } from "@astryxdesign/core/RadioList";
import { Selector } from "@astryxdesign/core/Selector";
import { Spinner } from "@astryxdesign/core/Spinner";
import { Switch } from "@astryxdesign/core/Switch";
import { Text } from "@astryxdesign/core/Text";
import { TextInput } from "@astryxdesign/core/TextInput";
import { useClipboard } from "@astryxdesign/core/hooks";
import {
  ArrowTopRightOnSquareIcon,
  CheckBadgeIcon,
  ClipboardDocumentIcon,
  CodeBracketIcon,
  EyeIcon,
  EyeSlashIcon,
  GlobeAltIcon,
  LockClosedIcon,
  MagnifyingGlassIcon,
  PencilSquareIcon,
  PlusIcon,
  TrashIcon,
  VariableIcon,
} from "@heroicons/react/24/outline";
import { useAppToast } from "@/components/app-toast";
import { apiClient } from "@/lib/api-client";
import type { PublicUser } from "@/lib/types";
import "./workspace-settings-panel.css";

type SettingsSection = "domains" | "env" | "login";

type EnvTarget = "all" | "production" | "preview" | "development";

interface EnvVariable {
  id: string;
  key: string;
  value: string;
  target: EnvTarget;
  updatedAt: number;
}

interface CustomDomain {
  id: string;
  hostname: string;
  status: "pending" | "valid";
  createdAt: number;
}

type LoginAudience = "everyone" | "selected";

interface LoginSettings {
  enabled: boolean;
  audience: LoginAudience;
  allowedUserIds: string[];
}

interface WorkspaceSettingsData {
  domains: CustomDomain[];
  envVars: EnvVariable[];
  login: LoginSettings;
}

const SECTIONS: {
  id: SettingsSection;
  label: string;
  icon: typeof GlobeAltIcon;
}[] = [
  { id: "domains", label: "Domains", icon: GlobeAltIcon },
  { id: "env", label: "Environment Variables", icon: VariableIcon },
  { id: "login", label: "Login Settings", icon: LockClosedIcon },
];

const ENV_TARGET_OPTIONS: { value: EnvTarget; label: string }[] = [
  { value: "all", label: "全部环境" },
  { value: "production", label: "生产环境" },
  { value: "preview", label: "预览环境" },
  { value: "development", label: "开发环境" },
];

const ENV_TARGET_LABEL: Record<EnvTarget, string> = {
  all: "全部环境",
  production: "生产环境",
  preview: "预览环境",
  development: "开发环境",
};

const ENV_KEY_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;
const DOMAIN_PATTERN =
  /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;
const CNAME_TARGET = "cname.workspace.local";
const DEFAULT_LOGIN: LoginSettings = {
  enabled: false,
  audience: "everyone",
  allowedUserIds: [],
};
const EMPTY_SETTINGS: WorkspaceSettingsData = {
  domains: [],
  envVars: [],
  login: DEFAULT_LOGIN,
};
const STORAGE_PREFIX = "agent_builder_workspace_settings:";

// ---------- scoped localStorage store ----------

const storeListeners = new Set<() => void>();
const snapshotCache = new Map<
  string,
  { raw: string | null; data: WorkspaceSettingsData }
>();

function parseLogin(value: unknown): LoginSettings {
  if (!value || typeof value !== "object") return DEFAULT_LOGIN;
  const raw = value as Partial<LoginSettings>;
  return {
    enabled: raw.enabled === true,
    audience: raw.audience === "selected" ? "selected" : "everyone",
    allowedUserIds: Array.isArray(raw.allowedUserIds)
      ? raw.allowedUserIds.filter((id): id is string => typeof id === "string")
      : [],
  };
}

function parseSettings(raw: string | null): WorkspaceSettingsData {
  if (!raw) return EMPTY_SETTINGS;
  try {
    const parsed = JSON.parse(raw) as Partial<WorkspaceSettingsData>;
    return {
      domains: Array.isArray(parsed.domains) ? parsed.domains : [],
      envVars: Array.isArray(parsed.envVars) ? parsed.envVars : [],
      login: parseLogin(parsed.login),
    };
  } catch {
    return EMPTY_SETTINGS;
  }
}

async function loadAllUsers(): Promise<PublicUser[]> {
  const first = await apiClient.listUsers({ page: 1, pageSize: 50 });
  if (first.totalPages <= 1) return first.users;
  const rest = await Promise.all(
    Array.from({ length: first.totalPages - 1 }, (_, index) =>
      apiClient.listUsers({ page: index + 2, pageSize: 50 })
    )
  );
  return [first, ...rest].flatMap((page) => page.users);
}

function readSettings(storageKey: string): WorkspaceSettingsData {
  if (typeof window === "undefined") return EMPTY_SETTINGS;
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(storageKey);
  } catch {
    raw = null;
  }
  const cached = snapshotCache.get(storageKey);
  if (cached && cached.raw === raw) return cached.data;
  const data = parseSettings(raw);
  snapshotCache.set(storageKey, { raw, data });
  return data;
}

function writeSettings(storageKey: string, data: WorkspaceSettingsData) {
  const raw = JSON.stringify(data);
  try {
    window.localStorage.setItem(storageKey, raw);
  } catch {
    // ignore quota errors and keep in-memory snapshot
  }
  snapshotCache.set(storageKey, { raw, data });
  for (const listener of storeListeners) listener();
}

function subscribeSettings(listener: () => void) {
  storeListeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    storeListeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

function useWorkspaceSettings(scopeKey: string) {
  const storageKey = `${STORAGE_PREFIX}${scopeKey}`;
  const getSnapshot = useCallback(() => readSettings(storageKey), [storageKey]);
  const data = useSyncExternalStore(
    subscribeSettings,
    getSnapshot,
    () => EMPTY_SETTINGS
  );
  const update = useCallback(
    (updater: (prev: WorkspaceSettingsData) => WorkspaceSettingsData) => {
      writeSettings(storageKey, updater(readSettings(storageKey)));
    },
    [storageKey]
  );
  return [data, update] as const;
}

function createId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function normalizeHostname(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "")
    .replace(/\.$/, "");
}

// ---------- section header ----------

function SectionHeader({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <VStack gap={0.5}>
      <Text
        type="large"
        weight="semibold"
        as="h2"
        className="ws-settings-title"
      >
        {title}
      </Text>
      <Text type="supporting" color="secondary">
        {description}
      </Text>
    </VStack>
  );
}

// ---------- Domains ----------

function DomainsSection({
  defaultHostname,
  domains,
  onChange,
}: {
  defaultHostname: string;
  domains: CustomDomain[];
  onChange: (updater: (prev: CustomDomain[]) => CustomDomain[]) => void;
}) {
  const toast = useAppToast();
  const { copy } = useClipboard({ announce: "已复制" });
  const [hostnameInput, setHostnameInput] = useState("");
  const [inputError, setInputError] = useState<string | null>(null);
  const [removing, setRemoving] = useState<CustomDomain | null>(null);

  function handleAdd() {
    const hostname = normalizeHostname(hostnameInput);
    if (!hostname) {
      setInputError("请输入域名");
      return;
    }
    if (!DOMAIN_PATTERN.test(hostname)) {
      setInputError("请输入有效的域名，例如 app.example.com");
      return;
    }
    if (
      hostname === defaultHostname ||
      domains.some((item) => item.hostname === hostname)
    ) {
      setInputError("该域名已添加");
      return;
    }
    onChange((prev) => [
      ...prev,
      { id: createId(), hostname, status: "pending", createdAt: Date.now() },
    ]);
    setHostnameInput("");
    setInputError(null);
    toast({ body: `已添加 ${hostname}`, uniqueID: "domain-added" });
  }

  function handleVerify(domain: CustomDomain) {
    onChange((prev) =>
      prev.map((item) =>
        item.id === domain.id ? { ...item, status: "valid" } : item
      )
    );
    toast({
      body: `${domain.hostname} 配置正确`,
      uniqueID: "domain-verified",
    });
  }

  async function handleCopy(text: string) {
    const ok = await copy(text);
    toast({
      body: ok ? `已复制 ${text}` : "复制失败",
      type: ok ? "success" : "error",
      uniqueID: "domain-copy",
    });
  }

  return (
    <VStack gap={4}>
      <SectionHeader
        title="Domains"
        description="发布后可用于访问此项目的域名"
      />

      <HStack gap={2} vAlign="start">
        <StackItem size="fill">
          <TextInput
            label="域名"
            isLabelHidden
            value={hostnameInput}
            onChange={(value) => {
              setHostnameInput(value);
              if (inputError) setInputError(null);
            }}
            onEnter={handleAdd}
            placeholder="app.example.com"
            startIcon={GlobeAltIcon}
            status={inputError ? { type: "error", message: inputError } : undefined}
            width="100%"
          />
        </StackItem>
        <Button
          label="添加"
          variant="primary"
          icon={<Icon icon={PlusIcon} size="sm" />}
          onClick={handleAdd}
        />
      </HStack>

      <Card padding={0}>
        <List hasDividers>
          <ListItem
            startContent={
              <span className="ws-settings-item-icon">
                <Icon icon={GlobeAltIcon} size="sm" color="secondary" />
              </span>
            }
            label={
              <HStack gap={2} vAlign="center">
                <Text type="code" maxLines={1} style={{ maxWidth: "20rem" }}>
                  {defaultHostname}
                </Text>
                <Badge label="默认" variant="neutral" />
              </HStack>
            }
            description="系统自动分配"
            endContent={
              <HStack gap={1} vAlign="center">
                <Button
                  label="复制域名"
                  variant="ghost"
                  size="sm"
                  isIconOnly
                  icon={<Icon icon={ClipboardDocumentIcon} size="sm" />}
                  onClick={() => void handleCopy(defaultHostname)}
                />
                <Button
                  label="访问"
                  variant="ghost"
                  size="sm"
                  isIconOnly
                  icon={<Icon icon={ArrowTopRightOnSquareIcon} size="sm" />}
                  href={`https://${defaultHostname}`}
                  target="_blank"
                />
              </HStack>
            }
          />
          {domains.map((domain) => (
            <ListItem
              key={domain.id}
              startContent={
                <span className="ws-settings-item-icon">
                  <Icon icon={GlobeAltIcon} size="sm" color="secondary" />
                </span>
              }
              label={
                <HStack gap={2} vAlign="center">
                  <Text type="code" maxLines={1} style={{ maxWidth: "20rem" }}>
                    {domain.hostname}
                  </Text>
                  {domain.status === "valid" ? (
                    <Badge label="配置有效" variant="success" />
                  ) : (
                    <Badge label="待验证" variant="warning" />
                  )}
                </HStack>
              }
              description={
                domain.status === "valid"
                  ? "DNS 记录已配置"
                  : `请添加指向 ${CNAME_TARGET} 的 CNAME 记录`
              }
              endContent={
                <HStack gap={1} vAlign="center">
                  {domain.status === "pending" && (
                    <Button
                      label="验证"
                      variant="secondary"
                      size="sm"
                      onClick={() => handleVerify(domain)}
                    />
                  )}
                  <MoreMenu
                    size="sm"
                    variant="ghost"
                    alignment="end"
                    label={`${domain.hostname} 更多操作`}
                    items={[
                      {
                        label: "复制域名",
                        icon: ClipboardDocumentIcon,
                        onClick: () => void handleCopy(domain.hostname),
                      },
                      {
                        label: "复制 CNAME 目标",
                        icon: CodeBracketIcon,
                        onClick: () => void handleCopy(CNAME_TARGET),
                      },
                      ...(domain.status === "valid"
                        ? [
                            {
                              label: "访问",
                              icon: ArrowTopRightOnSquareIcon,
                              onClick: () =>
                                window.open(
                                  `https://${domain.hostname}`,
                                  "_blank",
                                  "noopener"
                                ),
                            },
                          ]
                        : []),
                      {
                        label: "移除",
                        icon: TrashIcon,
                        onClick: () => setRemoving(domain),
                      },
                    ]}
                  />
                </HStack>
              }
            />
          ))}
        </List>
      </Card>

      {domains.some((item) => item.status === "pending") && (
        <Card variant="muted" padding={4}>
          <VStack gap={2}>
            <HStack gap={2} vAlign="center">
              <Icon icon={CheckBadgeIcon} size="sm" color="secondary" />
              <Text type="label" weight="semibold">
                DNS 配置
              </Text>
            </HStack>
            <Text type="supporting" color="secondary">
              请在 DNS 服务商处添加以下记录，然后点击验证
            </Text>
            <div className="ws-settings-dns-table">
              <Text type="supporting" color="secondary">
                类型
              </Text>
              <Text type="supporting" color="secondary">
                名称
              </Text>
              <Text type="supporting" color="secondary">
                值
              </Text>
              <Text type="code">CNAME</Text>
              <Text type="code">@ 或子域名</Text>
              <Text type="code">{CNAME_TARGET}</Text>
            </div>
          </VStack>
        </Card>
      )}

      <AlertDialog
        isOpen={removing !== null}
        onOpenChange={(open) => {
          if (!open) setRemoving(null);
        }}
        title={`移除 ${removing?.hostname ?? ""}？`}
        description="移除后该域名将不再指向此项目"
        actionLabel="移除"
        cancelLabel="取消"
        onAction={() => {
          if (!removing) return;
          const target = removing;
          onChange((prev) => prev.filter((item) => item.id !== target.id));
          setRemoving(null);
          toast({ body: `已移除 ${target.hostname}`, uniqueID: "domain-removed" });
        }}
      />
    </VStack>
  );
}

// ---------- Environment Variables ----------

interface EnvFormValues {
  key: string;
  value: string;
  target: EnvTarget;
}

const EMPTY_ENV_FORM: EnvFormValues = { key: "", value: "", target: "all" };

function validateEnvForm(
  values: EnvFormValues,
  envVars: EnvVariable[],
  editingId: string | null
): { key?: string; value?: string } {
  const errors: { key?: string; value?: string } = {};
  const key = values.key.trim();
  if (!key) {
    errors.key = "请输入变量名";
  } else if (!ENV_KEY_PATTERN.test(key)) {
    errors.key = "仅支持字母、数字和下划线，且不能以数字开头";
  } else {
    const conflict = envVars.some(
      (item) =>
        item.id !== editingId &&
        item.key === key &&
        (item.target === values.target ||
          item.target === "all" ||
          values.target === "all")
    );
    if (conflict) {
      errors.key = "该环境下已存在同名变量";
    }
  }
  if (!values.value) {
    errors.value = "请输入变量值";
  }
  return errors;
}

function EnvVarFields({
  values,
  errors,
  onChange,
}: {
  values: EnvFormValues;
  errors: { key?: string; value?: string };
  onChange: (values: EnvFormValues) => void;
}) {
  return (
    <>
      <TextInput
        label="变量名"
        value={values.key}
        onChange={(key) => onChange({ ...values, key: key.replace(/\s/g, "") })}
        placeholder="EXAMPLE_NAME"
        status={errors.key ? { type: "error", message: errors.key } : undefined}
        width="100%"
      />
      <TextInput
        label="变量值"
        value={values.value}
        onChange={(value) => onChange({ ...values, value })}
        placeholder="I9JU23NF394R6HH"
        status={
          errors.value ? { type: "error", message: errors.value } : undefined
        }
        width="100%"
      />
      <Selector
        label="环境"
        value={values.target}
        onChange={(target) => onChange({ ...values, target: target as EnvTarget })}
        options={ENV_TARGET_OPTIONS}
        width="100%"
      />
    </>
  );
}

function EnvironmentVariablesSection({
  envVars,
  onChange,
}: {
  envVars: EnvVariable[];
  onChange: (updater: (prev: EnvVariable[]) => EnvVariable[]) => void;
}) {
  const toast = useAppToast();
  const { copy } = useClipboard({ announce: "已复制" });
  const [form, setForm] = useState<EnvFormValues>(EMPTY_ENV_FORM);
  const [formErrors, setFormErrors] = useState<{ key?: string; value?: string }>(
    {}
  );
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [editing, setEditing] = useState<EnvVariable | null>(null);
  const [editForm, setEditForm] = useState<EnvFormValues>(EMPTY_ENV_FORM);
  const [editErrors, setEditErrors] = useState<{ key?: string; value?: string }>(
    {}
  );
  const [deleting, setDeleting] = useState<EnvVariable | null>(null);
  const [filter, setFilter] = useState<"any" | EnvTarget>("any");

  const visibleVars = useMemo(() => {
    const list =
      filter === "any"
        ? envVars
        : envVars.filter(
            (item) => item.target === filter || item.target === "all"
          );
    return [...list].sort((a, b) => b.updatedAt - a.updatedAt);
  }, [envVars, filter]);

  function handleAdd() {
    const errors = validateEnvForm(form, envVars, null);
    setFormErrors(errors);
    if (errors.key || errors.value) return;
    const key = form.key.trim();
    onChange((prev) => [
      ...prev,
      {
        id: createId(),
        key,
        value: form.value,
        target: form.target,
        updatedAt: Date.now(),
      },
    ]);
    setForm({ ...EMPTY_ENV_FORM, target: form.target });
    toast({ body: `已添加 ${key}`, uniqueID: "env-added" });
  }

  function openEdit(item: EnvVariable) {
    setEditing(item);
    setEditForm({ key: item.key, value: item.value, target: item.target });
    setEditErrors({});
  }

  function handleSaveEdit() {
    if (!editing) return;
    const errors = validateEnvForm(editForm, envVars, editing.id);
    setEditErrors(errors);
    if (errors.key || errors.value) return;
    const target = editing;
    onChange((prev) =>
      prev.map((item) =>
        item.id === target.id
          ? {
              ...item,
              key: editForm.key.trim(),
              value: editForm.value,
              target: editForm.target,
              updatedAt: Date.now(),
            }
          : item
      )
    );
    setEditing(null);
    toast({ body: `已更新 ${editForm.key.trim()}`, uniqueID: "env-updated" });
  }

  async function handleCopyValue(item: EnvVariable) {
    const ok = await copy(item.value);
    toast({
      body: ok ? `已复制 ${item.key} 的值` : "复制失败",
      type: ok ? "success" : "error",
      uniqueID: "env-copy",
    });
  }

  return (
    <VStack gap={4}>
      <SectionHeader
        title="Environment Variables"
        description="变量经加密存储，并在构建和运行时注入项目"
      />

      <VStack gap={6}>
      <Card>
        <VStack gap={4}>
          <div className="ws-settings-env-form">
            <EnvVarFields
              values={form}
              errors={formErrors}
              onChange={(values) => {
                setForm(values);
                if (formErrors.key || formErrors.value) setFormErrors({});
              }}
            />
          </div>
          <HStack hAlign="end">
            <Button
              label="添加变量"
              variant="primary"
              size="sm"
              icon={<Icon icon={PlusIcon} size="sm" />}
              onClick={handleAdd}
            />
          </HStack>
        </VStack>
      </Card>

      {envVars.length === 0 ? (
        <Card>
          <EmptyState
            title="暂无环境变量"
            description="在上方填写变量名和变量值，创建第一个变量"
          />
        </Card>
      ) : (
        <VStack gap={4}>
          <HStack vAlign="center">
            <Selector
              label="按环境筛选"
              isLabelHidden
              size="sm"
              value={filter}
              onChange={(value) => setFilter(value as "any" | EnvTarget)}
              options={[
                { value: "any", label: "全部变量" },
                ...ENV_TARGET_OPTIONS.filter((item) => item.value !== "all"),
              ]}
              width={180}
            />
          </HStack>
          <Card padding={0}>
            {visibleVars.length === 0 ? (
              <EmptyState
                title="暂无匹配的变量"
                description="请尝试切换其他环境"
              />
            ) : (
              <List hasDividers>
                {visibleVars.map((item) => {
                  const isRevealed = revealed[item.id] === true;
                  return (
                    <ListItem
                      key={item.id}
                      startContent={
                        <span className="ws-settings-item-icon">
                          <Icon
                            icon={CodeBracketIcon}
                            size="sm"
                            color="secondary"
                          />
                        </span>
                      }
                      label={
                        <Text
                          type="code"
                          maxLines={1}
                          style={{ maxWidth: "20rem" }}
                        >
                          {item.key}
                        </Text>
                      }
                      description={ENV_TARGET_LABEL[item.target]}
                      endContent={
                        <HStack gap={1} vAlign="center">
                          <Text
                            type="code"
                            color="secondary"
                            maxLines={1}
                            style={{ maxWidth: "12rem" }}
                          >
                            {isRevealed ? item.value : "••••••••••"}
                          </Text>
                          <Button
                            label={isRevealed ? "隐藏变量值" : "显示变量值"}
                            variant="ghost"
                            size="sm"
                            isIconOnly
                            icon={
                              <Icon
                                icon={isRevealed ? EyeSlashIcon : EyeIcon}
                                size="sm"
                              />
                            }
                            onClick={() =>
                              setRevealed((prev) => ({
                                ...prev,
                                [item.id]: !isRevealed,
                              }))
                            }
                          />
                          <MoreMenu
                            size="sm"
                            variant="ghost"
                            alignment="end"
                            label={`${item.key} 更多操作`}
                            items={[
                              {
                                label: "复制变量值",
                                icon: ClipboardDocumentIcon,
                                onClick: () => void handleCopyValue(item),
                              },
                              {
                                label: "编辑",
                                icon: PencilSquareIcon,
                                onClick: () => openEdit(item),
                              },
                              {
                                label: "删除",
                                icon: TrashIcon,
                                onClick: () => setDeleting(item),
                              },
                            ]}
                          />
                        </HStack>
                      }
                    />
                  );
                })}
              </List>
            )}
          </Card>
        </VStack>
      )}
      </VStack>

      <Dialog
        isOpen={editing !== null}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
        purpose="form"
        width={440}
      >
        <Layout
          header={
            <DialogHeader
              title="编辑环境变量"
              hasDivider
              onOpenChange={(open) => {
                if (!open) setEditing(null);
              }}
            />
          }
          content={
            <LayoutContent>
              <VStack gap={4}>
                <EnvVarFields
                  values={editForm}
                  errors={editErrors}
                  onChange={(values) => {
                    setEditForm(values);
                    if (editErrors.key || editErrors.value) setEditErrors({});
                  }}
                />
              </VStack>
            </LayoutContent>
          }
          footer={
            <LayoutFooter>
              <HStack gap={2} hAlign="end">
                <Button
                  label="取消"
                  variant="secondary"
                  onClick={() => setEditing(null)}
                />
                <Button label="保存" variant="primary" onClick={handleSaveEdit} />
              </HStack>
            </LayoutFooter>
          }
        />
      </Dialog>

      <AlertDialog
        isOpen={deleting !== null}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
        title={`删除 ${deleting?.key ?? ""}？`}
        description="删除后该变量将从项目中永久移除"
        actionLabel="删除"
        cancelLabel="取消"
        onAction={() => {
          if (!deleting) return;
          const target = deleting;
          onChange((prev) => prev.filter((item) => item.id !== target.id));
          setDeleting(null);
          toast({ body: `已删除 ${target.key}`, uniqueID: "env-deleted" });
        }}
      />
    </VStack>
  );
}

// ---------- Login ----------

function LoginAccessList({
  allowedUserIds,
  onChange,
}: {
  allowedUserIds: string[];
  onChange: (allowedUserIds: string[]) => void;
}) {
  const [users, setUsers] = useState<PublicUser[]>([]);
  const [usersState, setUsersState] = useState<
    "loading" | "ready" | "error"
  >("loading");
  const [usersError, setUsersError] = useState("暂时无法加载用户");
  const [query, setQuery] = useState("");

  useEffect(() => {
    let cancelled = false;
    void loadAllUsers()
      .then((next) => {
        if (cancelled) return;
        setUsers(next);
        setUsersState("ready");
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setUsersError(
          error instanceof Error && error.message
            ? error.message
            : "暂时无法加载用户"
        );
        setUsersState("error");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const normalizedQuery = query.trim().toLowerCase();
  const visibleUsers = useMemo(() => {
    if (!normalizedQuery) return users;
    return users.filter((user) =>
      user.username.toLowerCase().includes(normalizedQuery)
    );
  }, [normalizedQuery, users]);

  return (
    <VStack gap={4}>
      <TextInput
        label="搜索用户"
        placeholder="用户名"
        value={query}
        onChange={setQuery}
        startIcon={MagnifyingGlassIcon}
        isDisabled={usersState !== "ready"}
        width="100%"
      />
      {usersState === "loading" ? (
        <HStack gap={2} vAlign="center">
          <Spinner size="md" />
          <Text type="supporting" color="secondary">
            正在加载用户
          </Text>
        </HStack>
      ) : usersState === "error" ? (
        <EmptyState title="暂时无法加载用户" description={usersError} />
      ) : visibleUsers.length === 0 ? (
        <EmptyState
          title={normalizedQuery ? "没有匹配的用户" : "暂无用户"}
          description={
            normalizedQuery
              ? "请尝试其他用户名"
              : "系统中还没有可选择的用户"
          }
        />
      ) : (
        <CheckboxList
          label="允许查看的用户"
          hasDividers
          width="100%"
          value={allowedUserIds}
          onChange={onChange}
          status={
            allowedUserIds.length === 0
              ? { type: "warning", message: "请至少选择一位用户" }
              : undefined
          }
        >
          {visibleUsers.map((user) => (
            <CheckboxListItem
              key={user.id}
              value={user.id}
              align="center"
              label={
                <HStack gap={2} vAlign="center">
                  <Avatar
                    src={user.avatarUrl ?? undefined}
                    name={user.username}
                    size="sm"
                    tooltip={false}
                  />
                  <StackItem size="fill">
                    <Text
                      type="label"
                      maxLines={1}
                      style={{ minInlineSize: 0, maxInlineSize: "15rem" }}
                    >
                      {user.username}
                    </Text>
                  </StackItem>
                </HStack>
              }
              description={user.role === "admin" ? "管理员" : "普通用户"}
            />
          ))}
        </CheckboxList>
      )}
    </VStack>
  );
}

function LoginSettingsSection({
  login,
  onChange,
}: {
  login: LoginSettings;
  onChange: (next: LoginSettings) => void;
}) {
  return (
    <VStack gap={4}>
      <SectionHeader
        title="Login Settings"
        description="配置用户登录此项目的方式"
      />
      <Card>
        <FormLayout>
          <Switch
            label="启用登录"
            description="开启后，访问者需要登录才能查看此项目"
            htmlName="login-enabled"
            labelPosition="start"
            labelSpacing="spread"
            width="100%"
            value={login.enabled}
            onChange={(checked) => onChange({ ...login, enabled: checked })}
          />
          {login.enabled ? (
            <>
              <Divider isFullBleed />
              <RadioList
                label="谁可以查看"
                htmlName="login-audience"
                value={login.audience}
                width="100%"
                onChange={(value) => {
                  if (value !== "everyone" && value !== "selected") return;
                  onChange({ ...login, audience: value });
                }}
              >
                <RadioListItem
                  value="everyone"
                  label="所有登录用户"
                  description="任何已登录账号都可以查看"
                />
                <RadioListItem
                  value="selected"
                  label="指定用户"
                  description="仅允许选中的用户查看"
                />
              </RadioList>
              {login.audience === "selected" ? (
                <LoginAccessList
                  allowedUserIds={login.allowedUserIds}
                  onChange={(allowedUserIds) =>
                    onChange({ ...login, allowedUserIds })
                  }
                />
              ) : null}
            </>
          ) : null}
        </FormLayout>
      </Card>
    </VStack>
  );
}

// ---------- Panel ----------

export function WorkspaceSettingsPanel({
  scopeKey,
  defaultHostname,
}: {
  scopeKey: string;
  defaultHostname: string;
}) {
  const [section, setSection] = useState<SettingsSection>("domains");
  const [data, update] = useWorkspaceSettings(scopeKey);

  return (
    <Layout
      height="fill"
      start={
        <LayoutPanel width={232} hasDivider padding={0} isScrollable>
          <nav aria-label="设置分区" className="ws-settings-nav">
            {SECTIONS.map((item) => {
              const isActive = section === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  className="ws-settings-nav-item"
                  data-active={isActive ? "true" : "false"}
                  aria-current={isActive ? "page" : undefined}
                  onClick={() => setSection(item.id)}
                >
                  <Icon icon={item.icon} size="sm" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </LayoutPanel>
      }
      content={
        <LayoutContent isScrollable padding={0}>
          <div className="ws-settings-content">
            {section === "domains" ? (
              <DomainsSection
                defaultHostname={defaultHostname}
                domains={data.domains}
                onChange={(updater) =>
                  update((prev) => ({ ...prev, domains: updater(prev.domains) }))
                }
              />
            ) : section === "env" ? (
              <EnvironmentVariablesSection
                envVars={data.envVars}
                onChange={(updater) =>
                  update((prev) => ({ ...prev, envVars: updater(prev.envVars) }))
                }
              />
            ) : (
              <LoginSettingsSection
                login={data.login}
                onChange={(login) => update((prev) => ({ ...prev, login }))}
              />
            )}
          </div>
        </LayoutContent>
      }
    />
  );
}
