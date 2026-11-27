"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import {
  ChatComposer,
  ChatComposerDrawer,
  ChatComposerInput,
  type ChatComposerInputHandle,
  type ChatComposerTrigger,
} from "@astryxdesign/core/Chat";
import {
  createStaticSource,
  TypeaheadItem,
  type SearchableItem,
  type SearchSource,
} from "@astryxdesign/core/Typeahead";
import { Button } from "@astryxdesign/core/Button";
import { Selector } from "@astryxdesign/core/Selector";
import { HStack, StackItem, VStack } from "@astryxdesign/core/Stack";
import { Text } from "@astryxdesign/core/Text";
import { Token } from "@astryxdesign/core/Token";
import { Icon } from "@astryxdesign/core/Icon";
import {
  DropdownMenu,
  DropdownMenuDivider,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@astryxdesign/core/DropdownMenu";
import {
  AtSymbolIcon as MentionIcon,
  PaperClipIcon as AttachIcon,
  ArrowTurnDownLeftIcon,
  DocumentTextIcon,
  FolderIcon,
  PlusIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";
import { useAppToast } from "@/components/app-toast";
import { ModelProviderIcon } from "@/components/model-provider-icon";
import { RobotIcon } from "@/components/robot-icon";
import { apiClient } from "@/lib/api-client";
import type { AvailableModelOption, WorkspaceEntry } from "@/lib/types";

const MAX_IMAGE_ATTACHMENTS = 6;

const SUPPORTED_IMAGE_EXTENSIONS = new Set([
  "jpg",
  "jpeg",
  "png",
  "gif",
  "webp",
  "svg",
  "bmp",
  "ico",
  "avif",
  "tif",
  "tiff",
  "heic",
  "heif",
]);

const SUPPORTED_IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/svg+xml",
  "image/bmp",
  "image/x-ms-bmp",
  "image/x-icon",
  "image/vnd.microsoft.icon",
  "image/avif",
  "image/tiff",
  "image/heic",
  "image/heif",
  "image/heic-sequence",
  "image/heif-sequence",
]);

const IMAGE_FILE_ACCEPT = [
  ...SUPPORTED_IMAGE_MIME_TYPES,
  ...[...SUPPORTED_IMAGE_EXTENSIONS].map((extension) => `.${extension}`),
].join(",");

function fileExtension(name: string) {
  const base = name.trim().toLowerCase();
  const dot = base.lastIndexOf(".");
  if (dot <= 0 || dot === base.length - 1) return "";
  return base.slice(dot + 1);
}

function isSupportedImageFile(file: File) {
  const extension = fileExtension(file.name);
  if (SUPPORTED_IMAGE_EXTENSIONS.has(extension)) return true;
  const mime = file.type.split(";")[0]?.trim().toLowerCase() ?? "";
  return SUPPORTED_IMAGE_MIME_TYPES.has(mime);
}

type MentionItem = SearchableItem<{
  kind: WorkspaceEntry["kind"];
  directory: string;
}>;

function parentDirectory(filePath: string): string {
  const slash = filePath.lastIndexOf("/");
  return slash > 0 ? filePath.slice(0, slash) : "";
}

function toMentionItem(entry: WorkspaceEntry): MentionItem {
  return {
    id: entry.path,
    label: entry.name,
    auxiliaryData: {
      kind: entry.kind,
      directory: parentDirectory(entry.path),
    },
  };
}

const COMMAND_ITEMS: SearchableItem<{ description: string }>[] = [
  {
    id: "summarize",
    label: "summarize",
    auxiliaryData: { description: "Summarize the conversation" },
  },
  {
    id: "translate",
    label: "translate",
    auxiliaryData: { description: "Translate text to another language" },
  },
  {
    id: "search",
    label: "search",
    auxiliaryData: { description: "Search the web or documents" },
  },
  {
    id: "code",
    label: "code",
    auxiliaryData: { description: "Generate or explain code" },
  },
  {
    id: "help",
    label: "help",
    auxiliaryData: { description: "Show available commands" },
  },
];

/** A mention chip is followed by a non-breaking space, which does not start an @ query. */
function releaseMentionBoundary() {
  const selection = window.getSelection();
  if (!selection?.isCollapsed || selection.rangeCount === 0) return;
  const range = selection.getRangeAt(0);
  const node = range.startContainer;
  if (node.nodeType !== Node.TEXT_NODE) return;
  const text = node.textContent ?? "";
  const offset = range.startOffset;
  const before = text.slice(0, offset);
  const activeQuery = before.match(/\u00A0(@[^ \t\n\u00A0]*)$/);
  const nextBefore = activeQuery
    ? `${before.slice(0, before.length - activeQuery[0].length)} ${activeQuery[1]}`
    : before.endsWith("\u00A0")
      ? `${before.slice(0, -1)} `
      : null;
  if (nextBefore == null) return;
  node.textContent = nextBefore + text.slice(offset);
  const caret = document.createRange();
  caret.setStart(node, nextBefore.length);
  caret.collapse(true);
  selection.removeAllRanges();
  selection.addRange(caret);
}

function renderMentionItem(item: SearchableItem) {
  const data = item.auxiliaryData as MentionItem["auxiliaryData"] | undefined;
  return (
    <TypeaheadItem
      item={item}
      description={data?.directory || undefined}
      icon={
        <Icon
          icon={data?.kind === "directory" ? FolderIcon : DocumentTextIcon}
          size="sm"
        />
      }
    />
  );
}

const commandTrigger: ChatComposerTrigger = {
  character: "/",
  searchSource: createStaticSource(COMMAND_ITEMS),
  renderItem: (item) => (
    <TypeaheadItem
      item={item}
      description={(item.auxiliaryData as { description: string })?.description}
    />
  ),
  onSelect: (item) => ({
    value: `/${item.label}`,
    label: `/${item.label}`,
    variant: "yellow",
  }),
};

interface AttachmentItem {
  id: string;
  name: string;
}

export interface ProjectOption {
  id: string;
  name: string;
}

export interface ComposerQueueItem {
  id: string;
  content: string;
}

export interface AgentChatComposerProps {
  onSubmit: (value: string) => void | boolean | Promise<boolean | void>;
  isDisabled?: boolean;
  isRunning?: boolean;
  queue?: ComposerQueueItem[];
  onStop?: () => void;
  onQueue?: (value: string) => void;
  onSendQueued?: (id: string) => void;
  onRemoveQueued?: (id: string) => void;
  placeholder?: string;
  inputStyle?: CSSProperties;
  models?: AvailableModelOption[];
  selectedModelId?: string | null;
  isModelLoading?: boolean;
  onSelectModel?: (modelId: string) => void;
  projects?: ProjectOption[];
  selectedProjectId?: string | null;
  projectId?: string | null;
  onSelectProject?: (projectId: string) => void;
  onCreateProject?: () => void;
}

function queueLabel(content: string): string {
  return content.replace(/\s+/g, " ").trim();
}

export function AgentChatComposer({
  onSubmit,
  isDisabled = false,
  isRunning = false,
  queue = [],
  onStop,
  onQueue,
  onSendQueued,
  onRemoveQueued,
  placeholder = "Ask anything",
  inputStyle,
  models = [],
  selectedModelId,
  isModelLoading = false,
  onSelectModel,
  projects,
  selectedProjectId,
  projectId,
  onSelectProject,
  onCreateProject,
}: AgentChatComposerProps) {
  const toast = useAppToast();
  const [attachments, setAttachments] = useState<AttachmentItem[]>([]);
  const [composerValue, setComposerValue] = useState("");

  const composerInputRef = useRef<ChatComposerInputHandle>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const nextAttachmentIdRef = useRef(0);

  const modelMap = useMemo(
    () => new Map(models.map((item) => [item.id, item])),
    [models]
  );

  const activeModel = useMemo(() => {
    if (selectedModelId && modelMap.has(selectedModelId)) {
      return modelMap.get(selectedModelId) ?? null;
    }
    return models.find((item) => item.isDefault) ?? models[0] ?? null;
  }, [modelMap, models, selectedModelId]);

  const modelSelectorOptions = useMemo(
    () =>
      models.map((model) => ({
        value: model.id,
        label: model.name,
      })),
    [models]
  );

  const selectedProject =
    projects?.find((item) => item.id === selectedProjectId) ??
    projects?.[0] ??
    null;
  const mentionProjectId =
    projectId !== undefined ? projectId : (selectedProjectId ?? null);

  const mentionProjectRef = useRef(mentionProjectId);
  mentionProjectRef.current = mentionProjectId;
  const mentionAbortRef = useRef<AbortController | null>(null);
  const [mentionEntries, setMentionEntries] = useState<WorkspaceEntry[]>([]);
  const [mentionState, setMentionState] = useState<
    "idle" | "loading" | "ready" | "error"
  >("idle");

  const mentionSource = useMemo<SearchSource<MentionItem>>(() => {
    let controller: AbortController | null = null;
    const search = (query: string) => {
      controller?.abort();
      const current = new AbortController();
      controller = current;
      const id = mentionProjectRef.current;
      if (!id) return Promise.resolve([]);
      return apiClient
        .searchMentionableFiles(id, query, current.signal)
        .then((result) => result.entries.map(toMentionItem))
        .catch(() => [] as MentionItem[]);
    };
    return {
      search,
      bootstrap: () => search(""),
      cancel() {
        controller?.abort();
      },
    };
  }, []);

  const composerTriggers = useMemo<ChatComposerTrigger[]>(
    () => [
      {
        character: "@",
        searchSource: mentionSource,
        renderItem: renderMentionItem,
        menuLabel: "项目文件",
        loadingText: "正在查找",
        emptySearchText: mentionProjectId
          ? "没有可引用的文件"
          : "先选择 Project",
        onSelect: (item) => ({
          value: `@${item.id}`,
          label: item.id,
          variant: "blue",
        }),
      },
      commandTrigger,
    ],
    [mentionProjectId, mentionSource]
  );

  useEffect(() => {
    mentionAbortRef.current?.abort();
    setMentionEntries([]);
    setMentionState("idle");
  }, [mentionProjectId]);

  function addFiles(files: File[]) {
    if (files.length === 0) return;

    const images = files.filter(isSupportedImageFile);
    const skippedType = files.length - images.length;
    const remaining = MAX_IMAGE_ATTACHMENTS - attachments.length;
    const accepted = images.slice(0, Math.max(0, remaining));
    const skippedLimit = images.length - accepted.length;

    if (accepted.length > 0) {
      setAttachments((prev) => {
        const room = MAX_IMAGE_ATTACHMENTS - prev.length;
        const next = accepted.slice(0, Math.max(0, room));
        if (next.length === 0) return prev;
        return [
          ...prev,
          ...next.map((file) => ({
            id: `file-${++nextAttachmentIdRef.current}`,
            name: file.name,
          })),
        ];
      });
    }

    if (skippedType > 0 && skippedLimit > 0) {
      toast({
        body: "仅支持常见图片，最多添加 6 张",
        type: "error",
        uniqueID: "attachment-reject",
      });
    } else if (skippedType > 0) {
      toast({
        body: "仅支持 JPG、PNG、GIF、WebP、SVG 等常见图片",
        type: "error",
        uniqueID: "attachment-type",
      });
    } else if (skippedLimit > 0) {
      toast({
        body: "最多添加 6 张图片",
        type: "error",
        uniqueID: "attachment-limit",
      });
    }
  }

  function insertMention(entry: WorkspaceEntry) {
    const input = composerInputRef.current;
    if (!input) return;
    input.focus();
    if (document.activeElement) {
      const sel = window.getSelection();
      sel?.selectAllChildren(document.activeElement);
      sel?.collapseToEnd();
    }
    input.insertToken({
      value: `@${entry.path}`,
      label: entry.path,
      variant: "blue",
    });
  }

  function handleMentionMenu(isOpen: boolean) {
    mentionAbortRef.current?.abort();
    if (!isOpen) return;
    const id = mentionProjectRef.current;
    if (!id) {
      setMentionEntries([]);
      setMentionState("ready");
      return;
    }
    const controller = new AbortController();
    mentionAbortRef.current = controller;
    setMentionState((current) =>
      current === "ready" ? current : "loading"
    );
    void apiClient
      .searchMentionableFiles(id, "", controller.signal)
      .then((result) => {
        if (controller.signal.aborted) return;
        setMentionEntries(result.entries);
        setMentionState("ready");
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        setMentionEntries([]);
        setMentionState("error");
      });
  }

  async function handleComposerSubmit(value: string) {
    try {
      const result = await onSubmit(value);
      if (result !== false) {
        setAttachments([]);
      }
    } catch {
      // Caller handles error reporting; preserve attachments on failure
    }
  }

  const hasDraft = composerValue.trim().length > 0;
  const drawerCount = queue.length + attachments.length;

  return (
    <ChatComposer
      value={composerValue}
      onChange={setComposerValue}
      onSubmit={(value) => {
        if (isRunning) {
          onQueue?.(value);
          return;
        }
        void handleComposerSubmit(value);
      }}
      isStopShown={isRunning && !hasDraft}
      onStop={onStop}
      isDisabled={isDisabled}
      placeholder={placeholder}
      input={
        <ChatComposerInput
          handleRef={composerInputRef}
          triggers={composerTriggers}
          style={inputStyle}
          onKeyDown={(event) => {
            if (
              event.nativeEvent.isComposing ||
              event.ctrlKey ||
              event.metaKey ||
              event.altKey ||
              event.key.length !== 1
            ) {
              return;
            }
            releaseMentionBoundary();
          }}
          onFiles={addFiles}
        />
      }
      drawer={
        drawerCount > 0 ? (
          <ChatComposerDrawer
            count={drawerCount}
            label={queue.length > 0 ? "消息" : "附件"}
          >
            {queue.length > 0 ? (
              <VStack
                gap={1}
                width="100%"
                style={{ minWidth: "100%", flex: "1 0 100%" }}
              >
                {queue.map((item) => (
                  <HStack
                    key={item.id}
                    gap={2}
                    vAlign="center"
                    width="100%"
                    style={{
                      boxSizing: "border-box",
                      paddingInline: "var(--spacing-2)",
                      paddingBlock: "var(--spacing-1)",
                      borderRadius: "var(--radius-inner)",
                      background: "var(--color-neutral)",
                    }}
                  >
                    <StackItem size="fill" style={{ minWidth: 0 }}>
                      <Text type="label" maxLines={1}>
                        {queueLabel(item.content)}
                      </Text>
                    </StackItem>
                    <HStack gap={1} vAlign="center">
                      <button
                        type="button"
                        className="chat-composer-queue-action"
                        aria-label="发送"
                        onClick={() => onSendQueued?.(item.id)}
                      >
                        <Icon icon={ArrowTurnDownLeftIcon} size="sm" />
                      </button>
                      {onRemoveQueued ? (
                        <button
                          type="button"
                          className="chat-composer-queue-action"
                          aria-label="删除"
                          onClick={() => onRemoveQueued(item.id)}
                        >
                          <Icon icon={TrashIcon} size="sm" />
                        </button>
                      ) : null}
                    </HStack>
                  </HStack>
                ))}
              </VStack>
            ) : null}
            {attachments.map((item) => (
              <Token
                key={item.id}
                label={item.name}
                onRemove={() =>
                  setAttachments((prev) =>
                    prev.filter((entry) => entry.id !== item.id)
                  )
                }
              />
            ))}
          </ChatComposerDrawer>
        ) : undefined
      }
      headerActions={
        <>
          <DropdownMenu
            button={{
              label: "引用文件",
              variant: "ghost",
              size: "sm",
              icon: <Icon icon={MentionIcon} size="sm" />,
              isIconOnly: true,
            }}
            hasChevron={false}
            menuWidth={320}
            onOpenChange={handleMentionMenu}
          >
            {!mentionProjectId ? (
              <DropdownMenuItem label="先选择 Project" isDisabled />
            ) : mentionState === "error" ? (
              <DropdownMenuItem label="读取文件失败" isDisabled />
            ) : mentionState !== "ready" ? (
              <DropdownMenuItem label="正在查找" isDisabled />
            ) : mentionEntries.length === 0 ? (
              <DropdownMenuItem label="没有可引用的文件" isDisabled />
            ) : (
              mentionEntries.map((entry) => (
                <DropdownMenuItem
                  key={`${entry.kind}:${entry.path}`}
                  label={entry.name}
                  description={parentDirectory(entry.path) || undefined}
                  icon={
                    entry.kind === "directory" ? FolderIcon : DocumentTextIcon
                  }
                  onClick={() => insertMention(entry)}
                />
              ))
            )}
          </DropdownMenu>
          <Button
            label="Attach"
            variant="ghost"
            size="sm"
            icon={<Icon icon={AttachIcon} size="sm" />}
            isIconOnly
            onClick={() => fileInputRef.current?.click()}
          />
          <input
            ref={fileInputRef}
            type="file"
            accept={IMAGE_FILE_ACCEPT}
            multiple
            hidden
            onClick={(event) => event.stopPropagation()}
            onChange={(event) => {
              const files = Array.from(event.target.files ?? []);
              addFiles(files);
              event.target.value = "";
            }}
          />
        </>
      }
      footerActions={
        <>
          <Selector
            label="选择模型"
            isLabelHidden
            variant="ghost"
            size="md"
            controlClassName="chat-composer-model-selector"
            value={activeModel?.id}
            placeholder="暂无可用模型"
            options={modelSelectorOptions}
            hasSearch
            searchPlaceholder="搜索模型"
            emptyText="暂无可用模型"
            emptySearchText="未找到匹配的模型"
            isLoading={isModelLoading}
            isDisabled={isDisabled || isModelLoading}
            startIcon={
              activeModel ? (
                <ModelProviderIcon icon={activeModel.icon} size={16} />
              ) : (
                <Icon icon={RobotIcon} size="sm" />
              )
            }
            renderValue={(option) => {
              const model = modelMap.get(option.value);
              return (
                <Text
                  type="label"
                  maxLines={1}
                  style={{ maxInlineSize: "12rem" }}
                >
                  {model?.name ?? option.label}
                </Text>
              );
            }}
            renderOption={(option) => {
              const model = modelMap.get(option.value);
              if (!model) return option.label;
              return (
                <HStack
                  gap={2}
                  vAlign="center"
                  style={{ minInlineSize: 0, width: "100%" }}
                >
                  <ModelProviderIcon icon={model.icon} size={16} />
                  <StackItem size="fill" style={{ minInlineSize: 0 }}>
                    <Text type="label" maxLines={1}>
                      {model.name}
                    </Text>
                  </StackItem>
                </HStack>
              );
            }}
            onChange={(nextId) => onSelectModel?.(nextId)}
          />

          {projects !== undefined && (
            <DropdownMenu
              button={{
                label: selectedProject?.name ?? "选择 Project",
                variant: "ghost",
                size: "md",
                icon: <Icon icon={FolderIcon} size="sm" />,
                children: selectedProject?.name ?? "选择 Project",
              }}
              menuWidth={240}
            >
              {projects.length > 0 && (
                <DropdownMenuRadioGroup
                  label="选择 Project"
                  value={selectedProject?.id ?? ""}
                  onChange={(next) => onSelectProject?.(next)}
                >
                  {projects.map((project) => (
                    <DropdownMenuRadioItem
                      key={project.id}
                      value={project.id}
                      label={project.name}
                    />
                  ))}
                </DropdownMenuRadioGroup>
              )}
              {onCreateProject && (
                <>
                  {projects.length > 0 && <DropdownMenuDivider />}
                  <DropdownMenuItem
                    label="新建 Project"
                    icon={PlusIcon}
                    onClick={onCreateProject}
                  />
                </>
              )}
            </DropdownMenu>
          )}
        </>
      }
    />
  );
}
