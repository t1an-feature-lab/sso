"use client";

import { useId, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertDialog } from "@astryxdesign/core/AlertDialog";
import { Button } from "@astryxdesign/core/Button";
import { Card } from "@astryxdesign/core/Card";
import { EmptyState } from "@astryxdesign/core/EmptyState";
import { Heading } from "@astryxdesign/core/Heading";
import { HStack, StackItem, VStack } from "@astryxdesign/core/Stack";
import { Icon } from "@astryxdesign/core/Icon";
import { Text } from "@astryxdesign/core/Text";
import { TextInput } from "@astryxdesign/core/TextInput";
import { useAppToast } from "@/components/app-toast";
import type { ClientApplicationDetail, ClientSecret } from "@/common/types";
import { deleteClientSecretAction, generateClientSecretAction } from "@/server/application/actions";

const dateFormatter = new Intl.DateTimeFormat("zh-CN", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Shanghai",
});

export function ApplicationCredentials({ application }: { application: ClientApplicationDetail }) {
  const router = useRouter();
  const toast = useAppToast();
  const headingId = useId();
  const [operation, setOperation] = useState<"generate" | "delete" | null>(null);
  const [isRefreshing, startRefresh] = useTransition();
  const [revealedSecrets, setRevealedSecrets] = useState<Record<string, string>>({});
  const [loadingSecretId, setLoadingSecretId] = useState<string | null>(null);
  const [deletingSecret, setDeletingSecret] = useState<ClientSecret | null>(null);
  const actionInFlight = useRef(false);
  const pending = operation !== null || isRefreshing;
  const canDelete = application.clientSecrets.length > 1;

  async function copy(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value);
      toast({ body: `${label} 已复制`, uniqueID: "application-credential-copy" });
    } catch {
      toast({ body: "复制失败，请手动复制", type: "error", uniqueID: "application-credential-copy" });
    }
  }

  async function generateSecret() {
    if (pending || actionInFlight.current) return;
    actionInFlight.current = true;
    setOperation("generate");
    const data = new FormData();
    data.set("id", application.id);
    try {
      const result = await generateClientSecretAction({}, data);
      if (result.error || !result.clientSecret || !result.secretId) {
        toast({ body: result.error ?? "未能获取新密钥，请重试", type: "error", uniqueID: "application-secret-generate" });
        return;
      }
      const { secretId, clientSecret } = result;
      setRevealedSecrets((previous) => ({ ...previous, [secretId]: clientSecret }));
      toast({ body: result.success ?? "新密钥已生成", uniqueID: "application-secret-generate" });
      startRefresh(() => router.refresh());
    } catch {
      toast({ body: "生成失败，请稍后重试", type: "error", uniqueID: "application-secret-generate" });
    } finally {
      actionInFlight.current = false;
      setOperation(null);
    }
  }

  async function revealSecret(secret: ClientSecret) {
    if (pending || loadingSecretId !== null || actionInFlight.current) return;
    actionInFlight.current = true;
    setLoadingSecretId(secret.id);
    try {
      const response = await fetch(`/api/applications/${application.id}/secrets/${secret.id}`, {
        method: "POST",
        cache: "no-store",
      });
      const payload = (await response.json().catch(() => null)) as { clientSecret?: string; error?: string } | null;
      if (!response.ok || !payload?.clientSecret) {
        toast({ body: payload?.error ?? "密钥获取失败，请稍后重试", type: "error", uniqueID: "application-secret-reveal" });
        return;
      }
      const value = payload.clientSecret;
      setRevealedSecrets((previous) => ({ ...previous, [secret.id]: value }));
    } catch {
      toast({ body: "密钥获取失败，请稍后重试", type: "error", uniqueID: "application-secret-reveal" });
    } finally {
      actionInFlight.current = false;
      setLoadingSecretId(null);
    }
  }

  function hideSecret(secretId: string) {
    setRevealedSecrets((previous) => {
      if (!(secretId in previous)) return previous;
      const next = { ...previous };
      delete next[secretId];
      return next;
    });
  }

  async function deleteSecret() {
    if (!deletingSecret || !canDelete || pending || actionInFlight.current) return;
    actionInFlight.current = true;
    setOperation("delete");
    const targetId = deletingSecret.id;
    const data = new FormData();
    data.set("id", application.id);
    data.set("secretId", targetId);
    try {
      const result = await deleteClientSecretAction({}, data);
      if (result.error) {
        toast({ body: result.error, type: "error", uniqueID: "application-secret-delete" });
        return;
      }
      hideSecret(targetId);
      setDeletingSecret(null);
      toast({ body: result.success ?? "密钥已删除", uniqueID: "application-secret-delete" });
      startRefresh(() => router.refresh());
    } catch {
      toast({ body: "删除失败，请稍后重试", type: "error", uniqueID: "application-secret-delete" });
    } finally {
      actionInFlight.current = false;
      setOperation(null);
    }
  }

  return (
    <VStack as="section" gap={6} aria-label="应用凭证" aria-busy={pending || loadingSecretId !== null}>
      <HStack gap={2} vAlign="end">
        <StackItem size="fill">
          <TextInput label="Client ID" value={application.clientId} isReadOnly width="100%" />
        </StackItem>
        <Button label="复制 Client ID" icon={<Icon icon="copy" />} isIconOnly onClick={() => copy(application.clientId, "Client ID")} />
      </HStack>
      <VStack as="section" gap={4} aria-labelledby={headingId}>
        <HStack gap={3} hAlign="between" vAlign="center" wrap="wrap">
          <Heading level={3} accessibilityLevel={2} id={headingId}>Client secrets</Heading>
          <Button
            label="生成新密钥"
            onClick={generateSecret}
            isLoading={operation === "generate"}
            isDisabled={operation === "delete" || isRefreshing}
          />
        </HStack>
        {application.clientSecrets.length ? (
          <VStack gap={3} role="list" aria-label="Client secrets">
            {application.clientSecrets.map((secret) => {
              const revealed = revealedSecrets[secret.id];
              return (
                <Card key={secret.id} padding={4} role="listitem">
                  <VStack gap={3}>
                    <HStack gap={3} vAlign="center">
                      <Icon icon="wrench" />
                      <StackItem size="fill" style={{ minInlineSize: 0 }}>
                        <Text type="code" style={{ overflowWrap: "anywhere" }}>
                          {revealed ?? `••••••••${secret.lastFour}`}
                        </Text>
                      </StackItem>
                      <HStack gap={1} vAlign="center">
                        {revealed && (
                          <Button
                            label="复制"
                            aria-label={`复制尾号 ${secret.lastFour} 的密钥`}
                            icon={<Icon icon="copy" />}
                            variant="ghost"
                            size="sm"
                            onClick={() => copy(revealed, "Client Secret")}
                          />
                        )}
                        <Button
                          label={revealed ? "隐藏" : "查看"}
                          aria-label={`${revealed ? "隐藏" : "查看"}尾号 ${secret.lastFour} 的密钥`}
                          variant="ghost"
                          size="sm"
                          isLoading={loadingSecretId === secret.id}
                          isDisabled={pending || (!revealed && (!secret.canReveal || loadingSecretId !== null))}
                          tooltip={!revealed && !secret.canReveal ? "旧密钥无法查看，请生成新密钥" : undefined}
                          onClick={() => (revealed ? hideSecret(secret.id) : revealSecret(secret))}
                        />
                        <Button
                          label="删除"
                          aria-label={`删除尾号 ${secret.lastFour} 的密钥`}
                          variant="ghost"
                          size="sm"
                          isDisabled={pending || loadingSecretId !== null || !canDelete}
                          tooltip={!canDelete ? "至少保留一枚密钥" : undefined}
                          onClick={() => setDeletingSecret(secret)}
                        />
                      </HStack>
                    </HStack>
                    <HStack gap={3} wrap="wrap">
                      <Text type="supporting">创建于 <time dateTime={secret.createdAt}>{dateFormatter.format(new Date(secret.createdAt))}</time></Text>
                      <Text type="supporting">创建者：{secret.createdBy}</Text>
                    </HStack>
                    <Text type="supporting">
                      {secret.lastUsedAt
                        ? <>最近使用：<time dateTime={secret.lastUsedAt}>{dateFormatter.format(new Date(secret.lastUsedAt))}</time></>
                        : "从未使用"}
                    </Text>
                  </VStack>
                </Card>
              );
            })}
          </VStack>
        ) : (
          <Card padding={4}><EmptyState title="暂无密钥" isCompact /></Card>
        )}
      </VStack>
      <AlertDialog
        isOpen={deletingSecret !== null}
        onOpenChange={(open) => { if (!pending && !open) setDeletingSecret(null); }}
        title="删除这枚密钥？"
        description={`删除后，以 ${deletingSecret?.lastFour ?? ""} 结尾的密钥将立即失效`}
        actionLabel="删除密钥"
        cancelLabel="取消"
        onAction={deleteSecret}
        isActionLoading={operation === "delete"}
      />
    </VStack>
  );
}
