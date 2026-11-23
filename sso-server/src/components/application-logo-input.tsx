"use client";

import { useEffect, useId, useState } from "react";
import { Avatar } from "@astryxdesign/core/Avatar";
import { FieldLabel } from "@astryxdesign/core/Field";
import { FileInput } from "@astryxdesign/core/FileInput";
import { HStack, StackItem, VStack } from "@astryxdesign/core/Stack";
import { Text } from "@astryxdesign/core/Text";
import { MAX_IMAGE_SIZE_BYTES } from "@/common/image";

export function ApplicationLogoInput({
  file,
  logoUrl,
  applicationName,
  error,
  isDisabled,
  onChange,
}: {
  file: File | null;
  logoUrl: string;
  applicationName: string;
  error?: string;
  isDisabled: boolean;
  onChange: (file: File | null) => void;
}) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const inputId = useId();
  const hintId = useId();

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl, file]);

  function selectFile(value: File | File[] | null) {
    const next = Array.isArray(value) ? value[0] ?? null : value;
    setPreviewUrl(next ? URL.createObjectURL(next) : null);
    onChange(next);
  }

  return (
    <VStack gap={2} data-logo-field>
      <FieldLabel label="应用 Logo" inputID={inputId} isOptional isDisabled={isDisabled} />
      <HStack gap={4} vAlign="center" wrap="wrap">
        <StackItem>
          <Avatar src={(file ? previewUrl : logoUrl) || undefined} name={applicationName || "应用"} size={64} shape="rounded" tooltip={false} />
        </StackItem>
        <VStack gap={2} width={180} maxWidth="100%">
          <FileInput
            id={inputId}
            label="应用 Logo"
            isLabelHidden
            value={file}
            onChange={selectFile}
            accept="image/png,image/jpeg,image/webp"
            maxSize={MAX_IMAGE_SIZE_BYTES}
            placeholder="上传 Logo"
            mode="input"
            isOptional
            isDisabled={isDisabled}
            status={error ? { type: "error", message: error } : undefined}
            statusVariant="detached"
            aria-describedby={hintId}
            width="100%"
          />
          <Text type="supporting" id={hintId}>PNG / JPG / WebP，≤10 MB</Text>
        </VStack>
      </HStack>
    </VStack>
  );
}
