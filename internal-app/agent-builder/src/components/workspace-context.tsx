"use client";

import { createContext, useContext } from "react";
import type {
  AvailableModelOption,
  ChatSessionSummary,
  ProjectSummary,
  PublicUser,
} from "@/lib/types";

export interface WorkspaceContextValue {
  user: PublicUser;
  projects: ProjectSummary[];
  models: AvailableModelOption[];
  selectedModelId: string | null;
  switchingModel: boolean;
  selectDefaultModel: (modelId: string) => Promise<void>;
  selectedProjectId: string | null;
  setSelectedProjectId: (projectId: string | null) => void;
  refreshProjects: () => Promise<void>;
  prependSession: (session: ChatSessionSummary) => void;
  deleteSessionById: (sessionId: string) => Promise<void>;
  deleteProjectById: (projectId: string) => Promise<void>;
  openCreateProjectDialog: () => void;
}

export const WorkspaceContext = createContext<WorkspaceContextValue | null>(
  null
);

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) {
    throw new Error("useWorkspace must be used inside WorkspaceShell");
  }
  return ctx;
}
