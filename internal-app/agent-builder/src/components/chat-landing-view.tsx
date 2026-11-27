"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import {
  Layout,
  LayoutContent,
  VStack,
  HStack,
} from "@astryxdesign/core/Layout";
import { Text } from "@astryxdesign/core/Text";
import { Icon } from "@astryxdesign/core/Icon";
import { SparklesIcon } from "@heroicons/react/24/outline";
import { AgentChatComposer } from "@/components/agent-chat-composer";
import { useAppToast } from "@/components/app-toast";
import { useWorkspace } from "@/components/workspace-context";
import { apiClient } from "@/lib/api-client";

const pageStyle: CSSProperties = { minHeight: "100%" };
const composerInputStyle: CSSProperties = { minHeight: 84 };

export function ChatLandingView({
  initialProjectId,
}: {
  initialProjectId?: string;
}) {
  const router = useRouter();
  const toast = useAppToast();
  const {
    user,
    projects,
    models,
    selectedModelId,
    switchingModel,
    selectDefaultModel,
    selectedProjectId,
    setSelectedProjectId,
    prependSession,
    openCreateProjectDialog,
  } = useWorkspace();

  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (initialProjectId) {
      setSelectedProjectId(initialProjectId);
    }
  }, [initialProjectId, setSelectedProjectId]);

  async function handleSubmit(value: string): Promise<boolean> {
    const prompt = value.trim();
    if (!prompt || submitting) return false;

    setSubmitting(true);
    try {
      const { session } = await apiClient.createSession(
        prompt,
        selectedProjectId ?? undefined
      );
      prependSession({
        id: session.id,
        projectId: session.projectId,
        title: session.title,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
      });
      router.push(`/chat/${session.id}`);
      return true;
    } catch (error) {
      toast({
        body: error instanceof Error ? error.message : "创建对话失败",
        type: "error",
        uniqueID: "create-session-err",
      });
      setSubmitting(false);
      return false;
    }
  }

  return (
    <Layout
      height="fill"
      contentWidth={720}
      content={
        <LayoutContent role="main" padding={6}>
          <VStack gap={8} vAlign="center" style={pageStyle}>
            <VStack gap={1}>
              <HStack gap={2} vAlign="center">
                <Icon icon={SparklesIcon} size="md" color="accent" />
                <Text type="large" as="h2">
                  Hi, {user.username}
                </Text>
              </HStack>
              <Text type="display-2" as="h1">
                Where should we start?
              </Text>
            </VStack>

            <AgentChatComposer
              onSubmit={handleSubmit}
              isDisabled={submitting}
              inputStyle={composerInputStyle}
              models={models}
              selectedModelId={selectedModelId}
              isModelLoading={switchingModel}
              onSelectModel={(modelId) => void selectDefaultModel(modelId)}
              projects={projects}
              selectedProjectId={selectedProjectId}
              projectId={selectedProjectId}
              onSelectProject={setSelectedProjectId}
              onCreateProject={openCreateProjectDialog}
            />
          </VStack>
        </LayoutContent>
      }
    />
  );
}
