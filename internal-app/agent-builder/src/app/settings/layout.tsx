import type { ReactNode } from "react";
import { requireUser } from "@/server/auth";
import { SettingsShell } from "@/components/settings-shell";

export default async function SettingsLayout({
  children,
}: {
  children: ReactNode;
}) {
  const user = await requireUser("/settings/profile");

  return <SettingsShell userRole={user.role}>{children}</SettingsShell>;
}
