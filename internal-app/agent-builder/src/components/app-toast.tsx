"use client";

import { useCallback } from "react";
import { Icon } from "@astryxdesign/core/Icon";
import { HStack } from "@astryxdesign/core/HStack";
import { Text } from "@astryxdesign/core/Text";
import { useToast, type ToastOptions } from "@astryxdesign/core/Toast";
import "./app-toast.css";

type AppToastOptions = Omit<
  ToastOptions,
  "type" | "isAutoHide" | "autoHideDuration" | "renderContent"
> & {
  type?: "success" | "info" | "warning" | "error";
};

export function useAppToast() {
  const showToast = useToast();

  return useCallback(
    ({ body, type = "success", ...options }: AppToastOptions) =>
      showToast({
        ...options,
        type: type === "error" ? "error" : "info",
        isAutoHide: true,
        autoHideDuration: 5000,
        body: (
          <HStack gap={2} vAlign="start" data-app-toast-status={type}>
            <Icon icon={type} color="inherit" />
            <Text color="inherit">{body}</Text>
          </HStack>
        ),
      }),
    [showToast]
  );
}
