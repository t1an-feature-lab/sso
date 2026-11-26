"use client";

import { LucideProvider } from "lucide-react";
import { ThemeProvider } from "@/components/theme-provider";
import { ConfirmProvider } from "@/components/ui/confirm-dialog";
import { Toaster } from "@/components/ui/sonner";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <LucideProvider size={16} strokeWidth={2}>
        <ConfirmProvider>
          {children}
          <Toaster />
        </ConfirmProvider>
      </LucideProvider>
    </ThemeProvider>
  );
}
