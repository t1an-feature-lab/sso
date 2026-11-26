import { WorkspaceShell } from "@/components/layout/workspace-shell";
import { requireUser } from "@/lib/server/auth";
import { ensureStorage } from "@/lib/server/db";

export const dynamic = "force-dynamic";

export default async function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [user, storage] = await Promise.all([requireUser(), ensureStorage()]);

  return (
    <WorkspaceShell user={user} storageMode={storage.mode}>
      {children}
    </WorkspaceShell>
  );
}
