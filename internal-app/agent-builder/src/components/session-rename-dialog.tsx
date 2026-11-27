"use client";

import { useState } from "react";
import { Button } from "@astryxdesign/core/Button";
import { Dialog, DialogHeader } from "@astryxdesign/core/Dialog";
import { Layout, LayoutContent, LayoutFooter } from "@astryxdesign/core/Layout";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { TextInput } from "@astryxdesign/core/TextInput";
import { useAppToast } from "@/components/app-toast";

export interface SessionRenameDialogProps {
  isOpen: boolean;
  initialTitle: string;
  onOpenChange: (isOpen: boolean) => void;
  onSubmit: (title: string) => Promise<void>;
}

export function SessionRenameDialog({
  isOpen,
  initialTitle,
  onOpenChange,
  onSubmit,
}: SessionRenameDialogProps) {
  const toast = useAppToast();
  const [title, setTitle] = useState(initialTitle);
  const [submitting, setSubmitting] = useState(false);

  async function handleConfirm() {
    if (submitting) return;
    const trimmed = title.trim();
    if (!trimmed) {
      toast({
        body: "请输入会话名称",
        type: "error",
        uniqueID: "session-rename-err",
      });
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit(trimmed);
      onOpenChange(false);
    } catch (error) {
      toast({
        body: error instanceof Error ? error.message : "重命名会话失败",
        type: "error",
        uniqueID: "session-rename-err",
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!submitting) onOpenChange(open);
      }}
      purpose="form"
      width={440}
    >
      <Layout
        header={
          <DialogHeader
            title="重命名会话"
            hasDivider
            onOpenChange={(open) => {
              if (!submitting) onOpenChange(open);
            }}
          />
        }
        content={
          <LayoutContent>
            <VStack gap={4}>
              <TextInput
                label="会话名称"
                value={title}
                onChange={setTitle}
                placeholder="请输入会话名称"
                isDisabled={submitting}
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
                isDisabled={submitting}
                onClick={() => onOpenChange(false)}
              />
              <Button
                label="保存"
                variant="primary"
                isLoading={submitting}
                onClick={() => void handleConfirm()}
              />
            </HStack>
          </LayoutFooter>
        }
      />
    </Dialog>
  );
}
