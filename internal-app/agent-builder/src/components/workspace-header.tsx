"use client";

import type { ReactNode } from "react";
import { HStack } from "@astryxdesign/core/Layout";
import { Text } from "@astryxdesign/core/Text";
import { Toolbar } from "@astryxdesign/core/Toolbar";

export function WorkspaceHeader({
  title,
  endContent,
}: {
  title: string;
  endContent?: ReactNode;
}) {
  return (
    <Toolbar
      label="页面头部"
      dividers={["bottom"]}
      startContent={
        <HStack gap={2} vAlign="center" style={{ minWidth: 0 }}>
          <Text type="label" weight="semibold" maxLines={1}>
            {title}
          </Text>
        </HStack>
      }
      endContent={endContent}
    />
  );
}
