"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import { useRouter } from "next/navigation";
import { Avatar } from "@astryxdesign/core/Avatar";
import { Badge } from "@astryxdesign/core/Badge";
import { Button } from "@astryxdesign/core/Button";
import { FieldStatus } from "@astryxdesign/core/Field";
import { FormLayout } from "@astryxdesign/core/FormLayout";
import { Grid } from "@astryxdesign/core/Grid";
import { Icon } from "@astryxdesign/core/Icon";
import { Layout, LayoutContent } from "@astryxdesign/core/Layout";
import { MetadataList, MetadataListItem } from "@astryxdesign/core/MetadataList";
import { HStack, StackItem, VStack } from "@astryxdesign/core/Stack";
import { Text } from "@astryxdesign/core/Text";
import { TextInput } from "@astryxdesign/core/TextInput";
import { ArrowUpTrayIcon, TrashIcon } from "@heroicons/react/24/outline";
import { useAppToast } from "@/components/app-toast";
import { WorkspaceHeader } from "@/components/workspace-header";
import { apiClient } from "@/lib/api-client";
import {
  ALLOWED_AVATAR_MIME_TYPES,
  MAX_AVATAR_SIZE_BYTES,
  type PublicUser,
} from "@/lib/types";

function formatDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  const ss = String(date.getSeconds()).padStart(2, "0");
  return `${y}-${m}-${d} ${hh}:${mm}:${ss}`;
}

function validateUsername(value: string): string | undefined {
  const trimmed = value.trim();
  if (!trimmed) return "请输入用户名";
  if (trimmed.length > 64 || /\p{Cc}/u.test(trimmed)) {
    return "请输入 1–64 个字符的用户名，不能包含控制字符";
  }
  return undefined;
}

export function ProfileSettingsView({
  initialUser,
  projectCount,
  sessionCount,
}: {
  initialUser: PublicUser;
  projectCount: number;
  sessionCount: number;
}) {
  const router = useRouter();
  const toast = useAppToast();
  const hintId = useId();
  const avatarErrorId = useId();

  const [user, setUser] = useState<PublicUser>(initialUser);
  const [username, setUsername] = useState(initialUser.username);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [removeAvatar, setRemoveAvatar] = useState(false);
  const [usernameError, setUsernameError] = useState<string | undefined>();
  const [avatarError, setAvatarError] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const avatarButtonRef = useRef<HTMLButtonElement>(null);
  const usernameInputRef = useRef<HTMLInputElement>(null);
  const usernameDirtyRef = useRef(false);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const activeAvatarSrc =
    previewUrl ?? (removeAvatar ? undefined : (user.avatarUrl ?? undefined));

  function handleSelectAvatar(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;

    const allowed = (ALLOWED_AVATAR_MIME_TYPES as readonly string[]).includes(
      file.type
    );
    const error = !allowed
      ? "请选择 PNG、JPEG 或 WebP 格式的图片"
      : file.size <= 0
        ? "图片内容不能为空"
        : file.size > MAX_AVATAR_SIZE_BYTES
          ? "头像图片大小不能超过 5 MB"
          : undefined;

    setAvatarError(error);
    if (error) {
      avatarButtonRef.current?.focus();
      return;
    }

    setAvatarFile(file);
    setRemoveAvatar(false);
    setPreviewUrl(URL.createObjectURL(file));
  }

  function handleRemoveAvatar() {
    setAvatarFile(null);
    setPreviewUrl(null);
    setRemoveAvatar(true);
    setAvatarError(undefined);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;

    if (avatarError) {
      avatarButtonRef.current?.focus();
      return;
    }

    const nextUsernameError = validateUsername(username);
    setUsernameError(nextUsernameError);
    if (nextUsernameError) {
      usernameInputRef.current?.focus();
      return;
    }

    setSaving(true);
    try {
      const formData = new FormData();
      formData.set("username", username.trim());
      if (avatarFile) {
        formData.set("avatar", avatarFile);
      } else if (removeAvatar) {
        formData.set("removeAvatar", "true");
      }

      const { user: updated } = await apiClient.updateProfile(formData);
      setUser(updated);
      setUsername(updated.username);
      setAvatarFile(null);
      setPreviewUrl(null);
      setRemoveAvatar(false);
      usernameDirtyRef.current = false;
      toast({ body: "个人信息已保存", uniqueID: "profile-save-ok" });
      router.refresh();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "保存个人信息失败";
      if (message.includes("用户名")) {
        setUsernameError(message);
        usernameInputRef.current?.focus();
      } else if (message.includes("头像") || message.includes("图片")) {
        setAvatarError(message);
        avatarButtonRef.current?.focus();
      } else {
        toast({ body: message, type: "error", uniqueID: "profile-save-err" });
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <Layout
      height="fill"
      header={<WorkspaceHeader title="个人信息" />}
      content={
        <LayoutContent padding={6}>
          <Grid
            columns={{ minWidth: 320, max: 2, repeat: "fit" }}
            columnGap={10}
            rowGap={6}
            align="start"
            width="100%"
            maxWidth={920}
            style={{ marginInline: "auto", paddingBlock: "var(--spacing-4)" }}
          >
            <VStack gap={4}>
              <Text type="large" weight="semibold" as="h2">
                基本资料
              </Text>
              <form
                noValidate
                aria-label="编辑个人信息"
                aria-busy={saving}
                onSubmit={(event) => void handleSubmit(event)}
              >
                <VStack gap={5}>
                  <FormLayout>
                    <VStack gap={2}>
                      <HStack gap={4} vAlign="center">
                        <Avatar
                          src={activeAvatarSrc}
                          name={username.trim() || user.username}
                          size={64}
                          tooltip={false}
                        />
                        <StackItem size="fill">
                          <VStack gap={2} hAlign="start">
                            <HStack gap={2} vAlign="center">
                              <Button
                                ref={avatarButtonRef}
                                type="button"
                                label="更换头像"
                                variant="secondary"
                                size="sm"
                                icon={<Icon icon={ArrowUpTrayIcon} size="sm" />}
                                isDisabled={saving}
                                aria-invalid={Boolean(avatarError)}
                                aria-describedby={[
                                  hintId,
                                  avatarError ? avatarErrorId : "",
                                ]
                                  .filter(Boolean)
                                  .join(" ")}
                                onClick={() => fileInputRef.current?.click()}
                              />
                              {activeAvatarSrc && (
                                <Button
                                  type="button"
                                  label="移除头像"
                                  variant="ghost"
                                  size="sm"
                                  icon={<Icon icon={TrashIcon} size="sm" />}
                                  isDisabled={saving}
                                  onClick={handleRemoveAvatar}
                                />
                              )}
                            </HStack>
                            <Text
                              type="supporting"
                              color="secondary"
                              id={hintId}
                            >
                              支持 PNG、JPG、WebP 格式，大小不超过 5 MB
                            </Text>
                          </VStack>
                        </StackItem>
                      </HStack>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        onChange={handleSelectAvatar}
                        disabled={saving}
                        hidden
                      />
                      {avatarError && (
                        <FieldStatus
                          id={avatarErrorId}
                          type="error"
                          message={avatarError}
                          variant="detached"
                        />
                      )}
                    </VStack>

                    <TextInput
                      ref={usernameInputRef}
                      label="用户名"
                      htmlName="username"
                      value={username}
                      onChange={(next) => {
                        usernameDirtyRef.current = true;
                        setUsername(next);
                        if (usernameError) setUsernameError(undefined);
                      }}
                      onBlur={() => {
                        if (!usernameDirtyRef.current) return;
                        setUsernameError(validateUsername(username));
                      }}
                      placeholder="请输入用户名"
                      description="用于登录与界面展示，修改后下次登录请使用新用户名"
                      autoComplete="username"
                      autoCapitalize="none"
                      hasAutoCorrect={false}
                      hasSpellCheck={false}
                      isRequired
                      isDisabled={saving}
                      width="100%"
                      status={
                        usernameError
                          ? { type: "error", message: usernameError }
                          : undefined
                      }
                    />
                  </FormLayout>

                  <HStack hAlign="start">
                    <Button
                      type="submit"
                      label="保存修改"
                      variant="primary"
                      isLoading={saving}
                    />
                  </HStack>
                </VStack>
              </form>
            </VStack>

            <VStack gap={4}>
              <Text type="large" weight="semibold" as="h2">
                账号信息
              </Text>
              <MetadataList>
                <MetadataListItem label="角色">
                  <Badge
                    label={user.role === "admin" ? "管理员" : "普通用户"}
                    variant={user.role === "admin" ? "blue" : "neutral"}
                  />
                </MetadataListItem>
                <MetadataListItem label="账号类型">
                  {user.isBuiltIn ? "内置管理员" : "注册账号"}
                </MetadataListItem>
                <MetadataListItem label="账户 ID">
                  <Text
                    type="supporting"
                    wordBreak="break-all"
                    style={{
                      fontFamily: "var(--font-family-mono, monospace)",
                    }}
                  >
                    {user.id}
                  </Text>
                </MetadataListItem>
                <MetadataListItem label="Project 数量">
                  <Text hasTabularNumbers>{projectCount} 个</Text>
                </MetadataListItem>
                <MetadataListItem label="对话数量">
                  <Text hasTabularNumbers>{sessionCount} 个</Text>
                </MetadataListItem>
                <MetadataListItem label="注册时间">
                  <Text hasTabularNumbers>
                    <time dateTime={user.createdAt}>
                      {formatDateTime(user.createdAt)}
                    </time>
                  </Text>
                </MetadataListItem>
                <MetadataListItem label="最近更新">
                  <Text hasTabularNumbers>
                    <time dateTime={user.updatedAt}>
                      {formatDateTime(user.updatedAt)}
                    </time>
                  </Text>
                </MetadataListItem>
              </MetadataList>
            </VStack>
          </Grid>
        </LayoutContent>
      }
    />
  );
}
