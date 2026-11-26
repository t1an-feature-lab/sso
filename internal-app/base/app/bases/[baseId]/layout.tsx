import { CurrentUserProvider } from "@/components/auth/current-user-provider";
import { BaseWorkspaceShell } from "@/components/bitable/base-workspace-shell";
import { requireUser } from "@/lib/server/auth";

export default async function BaseLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  return (
    <CurrentUserProvider user={user}>
      <BaseWorkspaceShell>{children}</BaseWorkspaceShell>
    </CurrentUserProvider>
  );
}
