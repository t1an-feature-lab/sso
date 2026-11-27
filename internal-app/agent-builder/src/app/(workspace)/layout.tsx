import type { ReactNode } from "react";
import { requireUser } from "@/server/auth";
import { listAvailableModels } from "@/server/models";
import { listProjects } from "@/server/sessions";
import { WorkspaceShell } from "@/components/workspace-shell";

export default async function WorkspaceLayout({
  children,
}: {
  children: ReactNode;
}) {
  const user = await requireUser();
  const [projects, models] = await Promise.all([
    listProjects(user.id),
    listAvailableModels(),
  ]);

  return (
    <WorkspaceShell
      user={user}
      initialProjects={projects}
      initialModels={models}
    >
      {children}
    </WorkspaceShell>
  );
}
