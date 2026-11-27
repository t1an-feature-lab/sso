"use client";

import { useState, type CSSProperties, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { VStack, HStack, StackItem } from "@astryxdesign/core/Layout";
import { Grid } from "@astryxdesign/core/Grid";
import { Center } from "@astryxdesign/core/Center";
import { Card } from "@astryxdesign/core/Card";
import { Section } from "@astryxdesign/core/Section";
import { Text } from "@astryxdesign/core/Text";
import { Icon } from "@astryxdesign/core/Icon";
import { EmptyState } from "@astryxdesign/core/EmptyState";
import { TextInput } from "@astryxdesign/core/TextInput";
import { Button } from "@astryxdesign/core/Button";
import {
  SparklesIcon,
  CheckCircleIcon as SuccessIcon,
} from "@heroicons/react/24/outline";
import { apiClient } from "@/lib/api-client";
import { useAppToast } from "@/components/app-toast";

const COLUMN_MIN_WIDTH = 240;

const pageStyle: CSSProperties = {
  minHeight: "100%",
  backgroundColor: "var(--color-background-body)",
};

const cardWrap: CSSProperties = {
  width: "100%",
  maxWidth: 960,
  marginInline: "auto",
};

const coverContainer: CSSProperties = {
  width: "100%",
  height: "100%",
  minHeight: 360,
  display: "flex",
  flexDirection: "column",
  justifyContent: "space-between",
  padding: "var(--spacing-8)",
  background:
    "linear-gradient(145deg, color-mix(in srgb, var(--color-accent) 16%, var(--color-surface-wash)) 0%, var(--color-surface-wash) 55%, color-mix(in srgb, var(--color-accent) 8%, var(--color-surface-wash)) 100%)",
  borderRadius: "var(--radius-container)",
  border: "1px solid var(--color-border-subtle)",
};

const LOGIN_SPLIT_CSS = `
.login-split-grid {
  container-type: inline-size;
  container-name: login-split;
  padding: var(--spacing-8);
}
.login-split-image {
  width: 100%;
  order: 0;
}
@container login-split (max-width: 511px) {
  .login-split-grid {
    padding: var(--spacing-4);
  }
  .login-split-image {
    order: -1;
  }
}
`;

function resolveSafeNext(nextPath?: string): string {
  if (!nextPath || !nextPath.startsWith("/") || nextPath.startsWith("//")) {
    return "/";
  }
  return nextPath;
}

export function LoginSplitView({ nextPath }: { nextPath?: string }) {
  const router = useRouter();
  const toast = useAppToast();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  async function handleSubmit(event?: FormEvent) {
    event?.preventDefault();
    if (isLoading) return;

    const trimmed = username.trim();
    if (!trimmed) {
      setErrorMessage("请输入用户名");
      return;
    }
    if (!password) {
      setErrorMessage("请输入密码");
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    try {
      const result = await apiClient.login({ username: trimmed, password });
      setIsSuccess(true);
      toast({
        body: result.registered
          ? `已自动注册并登录为 ${result.user.username}`
          : `欢迎回来，${result.user.username}`,
        uniqueID: "login-success",
      });
      router.replace(resolveSafeNext(nextPath));
      router.refresh();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "登录失败，请稍后重试";
      setErrorMessage(message);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Center role="main" axis="both" padding={6} style={pageStyle}>
      <style>{LOGIN_SPLIT_CSS}</style>
      <VStack gap={4} width="100%">
        <div style={cardWrap}>
          <Card padding={0} width="100%">
            <Grid
              columns={{ minWidth: COLUMN_MIN_WIDTH, repeat: "fit" }}
              gap={8}
              align="stretch"
              className="login-split-grid"
            >
              <Section variant="transparent" padding={0} height="100%">
                <VStack gap={6} height="100%">
                  <HStack gap={2} vAlign="center">
                    <Icon icon={SparklesIcon} color="accent" />
                    <Text type="body" weight="bold">
                      Agent Builder
                    </Text>
                  </HStack>

                  <StackItem size="fill">
                    <Center axis="vertical" height="100%">
                      {isSuccess ? (
                        <EmptyState
                          headingLevel={1}
                          title="登录成功"
                          description="正在进入工作台…"
                          icon={<Icon icon={SuccessIcon} size="lg" />}
                        />
                      ) : (
                        <form
                          onSubmit={handleSubmit}
                          style={{ width: "100%" }}
                          noValidate
                        >
                          <VStack gap={5} hAlign="stretch" width="100%">
                            <Text type="display-1" as="h1">
                              登录
                            </Text>

                            <VStack gap={3}>
                              <TextInput
                                label="用户名"
                                isLabelHidden
                                placeholder="请输入用户名"
                                value={username}
                                onChange={(val: string) => {
                                  setUsername(val);
                                  setErrorMessage(null);
                                }}
                                size="lg"
                                isDisabled={isLoading}
                              />
                              <TextInput
                                label="密码"
                                isLabelHidden
                                placeholder="请输入密码"
                                type="password"
                                value={password}
                                onChange={(val: string) => {
                                  setPassword(val);
                                  setErrorMessage(null);
                                }}
                                size="lg"
                                isDisabled={isLoading}
                                status={
                                  errorMessage
                                    ? {
                                        type: "error",
                                        message: errorMessage,
                                      }
                                    : undefined
                                }
                              />
                            </VStack>

                            <Button
                              label="登录 / 注册"
                              type="submit"
                              variant="primary"
                              size="lg"
                              isLoading={isLoading}
                            />
                          </VStack>
                        </form>
                      )}
                    </Center>
                  </StackItem>

                  {!isSuccess && (
                    <Text type="supporting" color="secondary">
                      默认管理员：admin / admin
                    </Text>
                  )}
                </VStack>
              </Section>

              <div className="login-split-image">
                <div style={coverContainer}>
                  <VStack gap={2}>
                    <Text type="display-2" as="h2">
                      Agent Builder
                    </Text>
                  </VStack>
                </div>
              </div>
            </Grid>
          </Card>
        </div>
      </VStack>
    </Center>
  );
}
