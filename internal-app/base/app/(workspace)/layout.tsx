import { WorkspaceShell } from "@/components/layout/workspace-shell";
import { requireUser } from "@/lib/server/auth";

export const dynamic = "force-dynamic";

export default async function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();

  return <WorkspaceShell user={user}>{children}</WorkspaceShell>;
}
