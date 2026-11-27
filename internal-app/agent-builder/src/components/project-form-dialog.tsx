"use client";

import { useState } from "react";
import { Button } from "@astryxdesign/core/Button";
import { Dialog, DialogHeader } from "@astryxdesign/core/Dialog";
import { Layout, LayoutContent, LayoutFooter } from "@astryxdesign/core/Layout";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { TextInput } from "@astryxdesign/core/TextInput";
import { useAppToast } from "@/components/app-toast";

export interface ProjectFormValues {
  name: string;
  description?: string;
}

export interface ProjectFormDialogProps {
  isOpen: boolean;
  mode: "create" | "edit";
  initialName?: string;
  initialDescription?: string | null;
  onOpenChange: (isOpen: boolean) => void;
  onSubmit: (values: ProjectFormValues) => Promise<void>;
}

export function ProjectFormDialog({
  isOpen,
  mode,
  initialName = "",
  initialDescription = "",
  onOpenChange,
  onSubmit,
}: ProjectFormDialogProps) {
  const toast = useAppToast();
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription ?? "");
  const [submitting, setSubmitting] = useState(false);

  const title = mode === "edit" ? "编辑 Project" : "新建 Project";
  const submitLabel = mode === "edit" ? "保存" : "创建";

  async function handleConfirm() {
    if (submitting) return;
    const trimmedName = name.trim();
    if (!trimmedName) {
      toast({
        body: "请输入 Project 名称",
        type: "error",
        uniqueID: "project-form-err",
      });
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit({
        name: trimmedName,
        description: description.trim(),
      });
      onOpenChange(false);
    } catch (error) {
      toast({
        body:
          error instanceof Error
            ? error.message
            : mode === "edit"
              ? "更新 Project 失败"
              : "创建 Project 失败",
        type: "error",
        uniqueID: "project-form-err",
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
            title={title}
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
                label="Project 名称"
                value={name}
                onChange={setName}
                placeholder="例如：内部工作台"
                isDisabled={submitting}
              />
              <TextInput
                label="描述（可选）"
                value={description}
                onChange={setDescription}
                placeholder="简要说明该项目的工作空间用途"
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
                label={submitLabel}
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
