"use client";

import { useMemo, useRef, useState, type CSSProperties } from "react";
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
} from "@astryxdesign/core/Typeahead";
import { Button } from "@astryxdesign/core/Button";
import { Selector } from "@astryxdesign/core/Selector";
import { HStack, StackItem } from "@astryxdesign/core/Stack";
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
  FolderIcon,
  PlusIcon,
} from "@heroicons/react/24/outline";
import { ModelProviderIcon } from "@/components/model-provider-icon";
import { RobotIcon } from "@/components/robot-icon";
import type { AvailableModelOption } from "@/lib/types";

const MENTION_ITEMS: SearchableItem<{ role: string }>[] = [
  { id: "cindy", label: "Cindy Zhang", auxiliaryData: { role: "Design Systems" } },
  { id: "alex", label: "Alex Johnson", auxiliaryData: { role: "Frontend" } },
  { id: "sam", label: "Sam Rivera", auxiliaryData: { role: "Backend" } },
  { id: "jordan", label: "Jordan Lee", auxiliaryData: { role: "Product" } },
  { id: "taylor", label: "Taylor Kim", auxiliaryData: { role: "Design" } },
  { id: "morgan", label: "Morgan Chen", auxiliaryData: { role: "Infrastructure" } },
];

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

const mentionTrigger: ChatComposerTrigger = {
  character: "@",
  searchSource: createStaticSource(MENTION_ITEMS),
  renderItem: (item) => (
    <TypeaheadItem
      item={item}
      description={(item.auxiliaryData as { role: string })?.role}
    />
  ),
  onSelect: (item) => ({
    value: `@${item.id}`,
    label: item.label,
    variant: "blue",
  }),
};

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

const composerTriggers = [mentionTrigger, commandTrigger];

interface AttachmentItem {
  id: string;
  name: string;
}

export interface ProjectOption {
  id: string;
  name: string;
}

export interface AgentChatComposerProps {
  onSubmit: (value: string) => void | boolean | Promise<boolean | void>;
  isDisabled?: boolean;
  placeholder?: string;
  defaultAttachments?: string[];
  inputStyle?: CSSProperties;
  models?: AvailableModelOption[];
  selectedModelId?: string | null;
  isModelLoading?: boolean;
  onSelectModel?: (modelId: string) => void;
  projects?: ProjectOption[];
  selectedProjectId?: string | null;
  onSelectProject?: (projectId: string) => void;
  onCreateProject?: () => void;
}

export function AgentChatComposer({
  onSubmit,
  isDisabled = false,
  placeholder = "Ask anything",
  defaultAttachments = [],
  inputStyle,
  models = [],
  selectedModelId,
  isModelLoading = false,
  onSelectModel,
  projects,
  selectedProjectId,
  onSelectProject,
  onCreateProject,
}: AgentChatComposerProps) {
  const [attachments, setAttachments] = useState<AttachmentItem[]>(() =>
    defaultAttachments.map((name, index) => ({
      id: `initial-${index}`,
      name,
    }))
  );

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

  function addFiles(files: File[]) {
    if (files.length === 0) return;
    setAttachments((prev) => [
      ...prev,
      ...files.map((file) => ({
        id: `file-${++nextAttachmentIdRef.current}`,
        name: file.name,
      })),
    ]);
  }

  function insertMention(item: (typeof MENTION_ITEMS)[number]) {
    const input = composerInputRef.current;
    if (!input) return;
    input.focus();
    if (document.activeElement) {
      const sel = window.getSelection();
      sel?.selectAllChildren(document.activeElement);
      sel?.collapseToEnd();
    }
    input.insertToken({
      value: `@${item.id}`,
      label: item.label,
      variant: "blue",
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

  return (
    <ChatComposer
      onSubmit={(value) => void handleComposerSubmit(value)}
      isDisabled={isDisabled}
      placeholder={placeholder}
      input={
        <ChatComposerInput
          handleRef={composerInputRef}
          triggers={composerTriggers}
          style={inputStyle}
          onFiles={addFiles}
        />
      }
      drawer={
        attachments.length > 0 ? (
          <ChatComposerDrawer count={attachments.length}>
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
              label: "Reference",
              variant: "ghost",
              size: "sm",
              icon: <Icon icon={MentionIcon} size="sm" />,
              isIconOnly: true,
            }}
            hasChevron={false}
            menuWidth={240}
          >
            {MENTION_ITEMS.map((item) => (
              <DropdownMenuItem
                key={item.id}
                label={item.label}
                description={item.auxiliaryData?.role}
                onClick={() => insertMention(item)}
              />
            ))}
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
