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
import { deleteClientSecretAction, generateClientSecretAction } from "@/server/actions";

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
  const [newSecret, setNewSecret] = useState<string | null>(null);
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
    if (pending || actionInFlight.current || newSecret) return;
    actionInFlight.current = true;
    setOperation("generate");
    const data = new FormData();
    data.set("id", application.id);
    try {
      const result = await generateClientSecretAction({}, data);
      if (result.error || !result.clientSecret) {
        toast({ body: result.error ?? "未能获取新密钥，请重试", type: "error", uniqueID: "application-secret-generate" });
        return;
      }
      setNewSecret(result.clientSecret);
      toast({ body: result.success ?? "新密钥已生成", uniqueID: "application-secret-generate" });
      startRefresh(() => router.refresh());
    } catch {
      toast({ body: "生成失败，请稍后重试", type: "error", uniqueID: "application-secret-generate" });
    } finally {
      actionInFlight.current = false;
      setOperation(null);
    }
  }

  async function deleteSecret() {
    if (!deletingSecret || !canDelete || pending || actionInFlight.current) return;
    actionInFlight.current = true;
    setOperation("delete");
    const data = new FormData();
    data.set("id", application.id);
    data.set("secretId", deletingSecret.id);
    try {
      const result = await deleteClientSecretAction({}, data);
      if (result.error) {
        toast({ body: result.error, type: "error", uniqueID: "application-secret-delete" });
        return;
      }
      setNewSecret(null);
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
    <VStack as="section" gap={6} aria-label="应用凭证" aria-busy={pending}>
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
            isDisabled={operation === "delete" || isRefreshing || newSecret !== null}
            tooltip={newSecret ? "请先保存新生成的密钥" : undefined}
          />
        </HStack>
        {newSecret && (
          <Card variant="muted" padding={4}>
            <VStack gap={4}>
              <HStack gap={2} vAlign="end" wrap="wrap">
                <StackItem size="fill">
                  <TextInput label="新生成的 Client Secret（仅显示一次）" value={newSecret} isReadOnly width="100%" autoComplete="off" />
                </StackItem>
                <Button label="复制新密钥" icon={<Icon icon="copy" />} onClick={() => copy(newSecret, "新密钥")} />
              </HStack>
              <HStack>
                <Button label="我已保存" onClick={() => setNewSecret(null)} />
              </HStack>
            </VStack>
          </Card>
        )}
        {application.clientSecrets.length ? (
          <VStack gap={3} role="list" aria-label="Client secrets">
            {application.clientSecrets.map((secret) => (
              <Card key={secret.id} padding={4} role="listitem">
                <HStack gap={3} vAlign="start">
                  <Icon icon="wrench" />
                  <StackItem size="fill">
                    <VStack gap={3}>
                      <Text type="code">••••••••{secret.lastFour}</Text>
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
                  </StackItem>
                  <Button
                    label="删除"
                    aria-label={`删除尾号 ${secret.lastFour} 的密钥`}
                    variant="ghost"
                    size="sm"
                    isDisabled={pending || !canDelete}
                    tooltip={!canDelete ? "至少保留一枚密钥" : undefined}
                    onClick={() => setDeletingSecret(secret)}
                  />
                </HStack>
              </Card>
            ))}
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
