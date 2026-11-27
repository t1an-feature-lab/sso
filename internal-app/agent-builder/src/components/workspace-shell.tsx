"use client";

import { useCallback, useMemo, useRef, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AppShell } from "@astryxdesign/core/AppShell";
import { Button } from "@astryxdesign/core/Button";
import { Divider } from "@astryxdesign/core/Divider";
import { Icon } from "@astryxdesign/core/Icon";
import { Stack, VStack } from "@astryxdesign/core/Stack";
import { MoreMenu } from "@astryxdesign/core/MoreMenu";
import { NavIcon } from "@astryxdesign/core/NavIcon";
import {
  SideNav,
  SideNavHeading,
  SideNavItem,
  SideNavSection,
} from "@astryxdesign/core/SideNav";
import { Text } from "@astryxdesign/core/Text";
import { useImperativeAlertDialog } from "@astryxdesign/core/AlertDialog";
import { useContainerReveal } from "@astryxdesign/core/hooks";
import {
  SparklesIcon,
  PlusIcon,
  GlobeAltIcon,
  ChatBubbleLeftRightIcon,
  FolderIcon,
} from "@heroicons/react/24/outline";
import { AccountMenu } from "@/components/account-menu";
import { useAppToast } from "@/components/app-toast";
import {
  ProjectFormDialog,
  type ProjectFormValues,
} from "@/components/project-form-dialog";
import { SessionRenameDialog } from "@/components/session-rename-dialog";
import { WorkspaceContext } from "@/components/workspace-context";
import { apiClient } from "@/lib/api-client";
import type {
  AvailableModelOption,
  ChatSessionSummary,
  ProjectSummary,
  PublicUser,
} from "@/lib/types";

function SessionNavItem({
  session,
  isSelected,
  onRename,
  onDelete,
}: {
  session: ChatSessionSummary;
  isSelected: boolean;
  onRename: (session: ChatSessionSummary) => void;
  onDelete: (sessionId: string) => Promise<void>;
}) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { getContainerProps, getContentRevealProps } = useContainerReveal();
  const confirm = useImperativeAlertDialog();

  return (
    <Stack
      {...getContainerProps({ forceState: isMenuOpen ? "active" : undefined })}
    >
      <SideNavItem
        label={session.title}
        href={`/chat/${session.id}`}
        icon={ChatBubbleLeftRightIcon}
        isSelected={isSelected}
        actions={
          <span {...getContentRevealProps()}>
            <MoreMenu
              size="sm"
              label={`操作会话 ${session.title}`}
              onOpenChange={setIsMenuOpen}
              items={[
                {
                  label: "重命名",
                  onClick: () => onRename(session),
                },
                {
                  label: "删除",
                  variant: "destructive",
                  onClick: () =>
                    confirm.show({
                      title: `删除会话「${session.title}」？`,
                      description: "删除后该会话记录和代码产物将无法恢复",
                      actionLabel: "删除",
                      cancelLabel: "取消",
                      onAction: () => {
                        confirm.hide();
                        void onDelete(session.id);
                      },
                    }),
                },
              ]}
            />
          </span>
        }
      />
      {confirm.element}
    </Stack>
  );
}

function ProjectNavItem({
  project,
  pathname,
  onNewChatInProject,
  onEditProject,
  onDeleteProject,
  onRenameSession,
  onDeleteSession,
}: {
  project: ProjectSummary;
  pathname: string;
  onNewChatInProject: (projectId: string) => void;
  onEditProject: (project: ProjectSummary) => void;
  onDeleteProject: (projectId: string) => Promise<void>;
  onRenameSession: (session: ChatSessionSummary) => void;
  onDeleteSession: (sessionId: string) => Promise<void>;
}) {
  const confirm = useImperativeAlertDialog();

  return (
    <>
      <SideNavItem
        label={project.name}
        icon={FolderIcon}
        collapsible
        actions={
          <MoreMenu
            size="sm"
            label={`操作 Project ${project.name}`}
            items={[
              {
                label: "新建会话",
                onClick: () => onNewChatInProject(project.id),
              },
              {
                label: "编辑 Project",
                onClick: () => onEditProject(project),
              },
              {
                label: "删除 Project",
                variant: "destructive",
                onClick: () =>
                  confirm.show({
                    title: `删除 Project「${project.name}」？`,
                    description: "删除后该项目下的所有会话和代码产物将无法恢复",
                    actionLabel: "删除",
                    cancelLabel: "取消",
                    onAction: () => {
                      confirm.hide();
                      void onDeleteProject(project.id);
                    },
                  }),
              },
            ]}
          />
        }
      >
        {project.sessions.length === 0 ? (
          <VStack
            padding={2}
            style={{ paddingInlineStart: "var(--spacing-8)" }}
          >
            <Text type="supporting" color="secondary">
              暂无会话
            </Text>
          </VStack>
        ) : (
          project.sessions.map((session) => (
            <SessionNavItem
              key={session.id}
              session={session}
              isSelected={pathname === `/chat/${session.id}`}
              onRename={onRenameSession}
              onDelete={onDeleteSession}
            />
          ))
        )}
      </SideNavItem>
      {confirm.element}
    </>
  );
}

export function WorkspaceShell({
  user,
  initialProjects,
  initialModels,
  children,
}: {
  user: PublicUser;
  initialProjects: ProjectSummary[];
  initialModels: AvailableModelOption[];
  children: ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const toast = useAppToast();

  const [projects, setProjects] = useState<ProjectSummary[]>(initialProjects);
  const [models, setModels] = useState<AvailableModelOption[]>(initialModels);
  const [switchingModel, setSwitchingModel] = useState(false);
  const [selectedProjectIdState, setSelectedProjectIdState] = useState<
    string | null
  >(initialProjects[0]?.id ?? null);

  // Create / edit project modal state
  const [projectDialog, setProjectDialog] = useState<
    | { mode: "create"; nonce: number }
    | { mode: "edit"; project: ProjectSummary; nonce: number }
    | null
  >(null);
  const projectDialogNonceRef = useRef(0);

  // Rename session modal state
  const [renameSessionDialog, setRenameSessionDialog] = useState<{
    session: ChatSessionSummary;
    nonce: number;
  } | null>(null);
  const renameSessionNonceRef = useRef(0);

  const selectedProjectId = useMemo(() => {
    if (
      selectedProjectIdState &&
      projects.some((item) => item.id === selectedProjectIdState)
    ) {
      return selectedProjectIdState;
    }
    return projects[0]?.id ?? null;
  }, [projects, selectedProjectIdState]);

  const selectedModelId = useMemo(() => {
    return models.find((item) => item.isDefault)?.id ?? models[0]?.id ?? null;
  }, [models]);

  const selectDefaultModel = useCallback(
    async (modelId: string) => {
      if (switchingModel || modelId === selectedModelId) return;
      const target = models.find((item) => item.id === modelId);
      if (!target) return;

      const previousModels = models;
      setSwitchingModel(true);
      setModels((prev) =>
        prev.map((item) => ({
          ...item,
          isDefault: item.id === modelId,
        }))
      );

      try {
        const { model } = await apiClient.setDefaultModel(modelId);
        setModels((prev) =>
          prev.map((item) =>
            item.id === model.id
              ? { ...model, isDefault: true }
              : { ...item, isDefault: false }
          )
        );
      } catch (error) {
        setModels(previousModels);
        toast({
          body: error instanceof Error ? error.message : "切换默认模型失败",
          type: "error",
          uniqueID: "switch-default-model-err",
        });
      } finally {
        setSwitchingModel(false);
      }
    },
    [models, selectedModelId, switchingModel, toast]
  );

  const setSelectedProjectId = useCallback((projectId: string | null) => {
    setSelectedProjectIdState(projectId);
  }, []);

  const refreshProjects = useCallback(async () => {
    try {
      const { projects: next } = await apiClient.listProjects();
      setProjects(next);
    } catch {
      // Keep existing list on transient error
    }
  }, []);

  const prependSession = useCallback((session: ChatSessionSummary) => {
    setProjects((prev) => {
      const targetProjectId = session.projectId ?? prev[0]?.id;
      if (!targetProjectId) return prev;
      const target = prev.find((project) => project.id === targetProjectId);
      if (!target) return prev;
      const updatedProject: ProjectSummary = {
        ...target,
        updatedAt: session.updatedAt,
        sessions: [
          session,
          ...target.sessions.filter((item) => item.id !== session.id),
        ],
      };
      return [
        updatedProject,
        ...prev.filter((project) => project.id !== targetProjectId),
      ];
    });
  }, []);

  const deleteSessionById = useCallback(
    async (sessionId: string) => {
      try {
        await apiClient.deleteSession(sessionId);
        setProjects((prev) =>
          prev.map((project) => ({
            ...project,
            sessions: project.sessions.filter((item) => item.id !== sessionId),
          }))
        );
        toast({ body: "已删除会话", uniqueID: `delete-session-${sessionId}` });
        if (pathname === `/chat/${sessionId}`) {
          router.replace("/");
        }
      } catch (error) {
        toast({
          body: error instanceof Error ? error.message : "删除会话失败",
          type: "error",
          uniqueID: `delete-session-err-${sessionId}`,
        });
      }
    },
    [pathname, router, toast]
  );

  const deleteProjectById = useCallback(
    async (projectId: string) => {
      const target = projects.find((item) => item.id === projectId);
      const containsActiveSession =
        target?.sessions.some((s) => pathname === `/chat/${s.id}`) ?? false;

      try {
        await apiClient.deleteProject(projectId);
        setProjects((prev) => prev.filter((item) => item.id !== projectId));
        toast({
          body: "已删除 Project",
          uniqueID: `delete-project-${projectId}`,
        });
        if (containsActiveSession) {
          router.replace("/");
        }
      } catch (error) {
        toast({
          body: error instanceof Error ? error.message : "删除 Project 失败",
          type: "error",
          uniqueID: `delete-project-err-${projectId}`,
        });
      }
    },
    [pathname, projects, router, toast]
  );

  const openCreateProjectDialog = useCallback(() => {
    projectDialogNonceRef.current += 1;
    setProjectDialog({ mode: "create", nonce: projectDialogNonceRef.current });
  }, []);

  const openEditProjectDialog = useCallback((project: ProjectSummary) => {
    projectDialogNonceRef.current += 1;
    setProjectDialog({
      mode: "edit",
      project,
      nonce: projectDialogNonceRef.current,
    });
  }, []);

  const openRenameSessionDialog = useCallback((session: ChatSessionSummary) => {
    renameSessionNonceRef.current += 1;
    setRenameSessionDialog({
      session,
      nonce: renameSessionNonceRef.current,
    });
  }, []);

  async function handleSubmitSessionRename(nextTitle: string) {
    if (!renameSessionDialog) return;
    const { session: updated } = await apiClient.renameSession(
      renameSessionDialog.session.id,
      nextTitle
    );
    setProjects((prev) =>
      prev.map((project) => ({
        ...project,
        sessions: project.sessions.map((item) =>
          item.id === updated.id ? updated : item
        ),
      }))
    );
    toast({
      body: "已重命名会话",
      uniqueID: `rename-session-${updated.id}`,
    });
  }

  const handleNewChatInProject = useCallback(
    (projectId: string) => {
      setSelectedProjectIdState(projectId);
      if (pathname !== "/") {
        router.push("/");
      }
    },
    [pathname, router]
  );

  async function handleSubmitProjectForm(values: ProjectFormValues) {
    if (!projectDialog) return;
    if (projectDialog.mode === "create") {
      const { project } = await apiClient.createProject({
        name: values.name,
        description: values.description || undefined,
      });
      setProjects((prev) => [project, ...prev]);
      setSelectedProjectIdState(project.id);
      toast({ body: "已创建 Project", uniqueID: "create-project-ok" });
      return;
    }

    const { project: updated } = await apiClient.updateProject(
      projectDialog.project.id,
      {
        name: values.name,
        description: values.description ?? "",
      }
    );
    setProjects((prev) =>
      prev.map((item) => (item.id === updated.id ? updated : item))
    );
    toast({ body: "已更新 Project", uniqueID: `update-project-${updated.id}` });
  }

  const contextValue = useMemo(
    () => ({
      user,
      projects,
      models,
      selectedModelId,
      switchingModel,
      selectDefaultModel,
      selectedProjectId,
      setSelectedProjectId,
      refreshProjects,
      prependSession,
      deleteSessionById,
      deleteProjectById,
      openCreateProjectDialog,
    }),
    [
      user,
      projects,
      models,
      selectedModelId,
      switchingModel,
      selectDefaultModel,
      selectedProjectId,
      setSelectedProjectId,
      refreshProjects,
      prependSession,
      deleteSessionById,
      deleteProjectById,
      openCreateProjectDialog,
    ]
  );

  return (
    <WorkspaceContext value={contextValue}>
      <AppShell
        contentPadding={0}
        sideNav={
          <SideNav
            resizable={{ defaultWidth: 280, minWidth: 220, maxWidth: 400 }}
            header={
              <SideNavHeading
                heading="Agent Builder"
                icon={<NavIcon icon={<Icon icon={SparklesIcon} size="sm" />} />}
                headingHref="/"
              />
            }
            topContent={
              <SideNavSection title="导航" isHeaderHidden>
                <SideNavItem
                  label="新建对话"
                  icon={PlusIcon}
                  href="/"
                  isSelected={pathname === "/"}
                />
                <SideNavItem
                  label="我的站点"
                  icon={GlobeAltIcon}
                  href="/sites"
                  isSelected={pathname === "/sites"}
                />
              </SideNavSection>
            }
            footer={<AccountMenu user={user} />}
          >
            <Divider />
            <SideNavSection
              title="Projects"
              endContent={
                <Button
                  label="新建 Project"
                  variant="ghost"
                  size="sm"
                  icon={<Icon icon={PlusIcon} size="sm" />}
                  isIconOnly
                  onClick={openCreateProjectDialog}
                />
              }
            >
              {projects.length === 0 ? (
                <VStack padding={3}>
                  <Text type="supporting" color="secondary">
                    暂无 Project
                  </Text>
                </VStack>
              ) : (
                <VStack gap={0.5}>
                  {projects.map((project) => (
                    <ProjectNavItem
                      key={project.id}
                      project={project}
                      pathname={pathname}
                      onNewChatInProject={handleNewChatInProject}
                      onEditProject={openEditProjectDialog}
                      onDeleteProject={deleteProjectById}
                      onRenameSession={openRenameSessionDialog}
                      onDeleteSession={deleteSessionById}
                    />
                  ))}
                </VStack>
              )}
            </SideNavSection>
          </SideNav>
        }
      >
        {children}
      </AppShell>

      {projectDialog && (
        <ProjectFormDialog
          key={
            projectDialog.mode === "edit"
              ? `edit-${projectDialog.project.id}-${projectDialog.nonce}`
              : `create-${projectDialog.nonce}`
          }
          isOpen
          mode={projectDialog.mode}
          initialName={
            projectDialog.mode === "edit" ? projectDialog.project.name : ""
          }
          initialDescription={
            projectDialog.mode === "edit"
              ? projectDialog.project.description
              : ""
          }
          onOpenChange={(open) => {
            if (!open) setProjectDialog(null);
          }}
          onSubmit={handleSubmitProjectForm}
        />
      )}

      {renameSessionDialog && (
        <SessionRenameDialog
          key={`rename-session-${renameSessionDialog.session.id}-${renameSessionDialog.nonce}`}
          isOpen
          initialTitle={renameSessionDialog.session.title}
          onOpenChange={(open) => {
            if (!open) setRenameSessionDialog(null);
          }}
          onSubmit={handleSubmitSessionRename}
        />
      )}
    </WorkspaceContext>
  );
}
