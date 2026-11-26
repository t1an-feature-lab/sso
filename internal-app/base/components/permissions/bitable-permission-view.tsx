"use client";

import {
  CheckIcon,
  ChevronDownIcon,
  Columns3Icon,
  CopyIcon,
  DatabaseIcon,
  InfoIcon,
  LayoutGridIcon,
  RotateCcwIcon,
  Rows3Icon,
  Table2Icon,
} from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ALL_BITABLE_SCOPE_IDS,
  BITABLE_RESOURCE_GROUPS,
  BITABLE_SCOPES,
  DEFAULT_PRINCIPAL_CONFIG,
  READONLY_BITABLE_SCOPE_IDS,
  STANDARD_WRITE_BITABLE_SCOPE_IDS,
  addScopesWithDependencies,
  removeScopesWithDependents,
  type BitableResourceGroupId,
  type BitableScopeId,
  type PermissionPrincipal,
  type PrincipalPermissionConfig,
  type ScopeAccessLevel,
} from "@/lib/permissions/bitable-scopes";
import { cn } from "@/lib/utils";

const GROUP_ICONS: Record<BitableResourceGroupId, ReactNode> = {
  base: <DatabaseIcon className="size-4 text-muted-foreground" aria-hidden="true" />,
  table: <Table2Icon className="size-4 text-muted-foreground" aria-hidden="true" />,
  field: <Columns3Icon className="size-4 text-muted-foreground" aria-hidden="true" />,
  record: <Rows3Icon className="size-4 text-muted-foreground" aria-hidden="true" />,
  view: <LayoutGridIcon className="size-4 text-muted-foreground" aria-hidden="true" />,
};

const GROUP_PARENT_LABELS: Record<BitableResourceGroupId, string | null> = {
  base: null,
  table: "数据库",
  field: "数据表",
  record: "数据表",
  view: "数据表",
};

const LEVEL_LABELS: Record<ScopeAccessLevel, string> = {
  read: "只读",
  write: "写入",
  destructive: "删除",
};

interface BitablePermissionViewProps {
  initialTab?: PermissionPrincipal;
}

export function BitablePermissionView({
  initialTab = "user",
}: BitablePermissionViewProps) {
  const [activeTab, setActiveTab] = useState<PermissionPrincipal>(initialTab);
  const [configs, setConfigs] = useState<
    Record<PermissionPrincipal, PrincipalPermissionConfig>
  >(() => ({
    user: {
      scopes: [...DEFAULT_PRINCIPAL_CONFIG.user.scopes],
      ownershipPolicy: DEFAULT_PRINCIPAL_CONFIG.user.ownershipPolicy,
    },
    app: {
      scopes: [...DEFAULT_PRINCIPAL_CONFIG.app.scopes],
      ownershipPolicy: DEFAULT_PRINCIPAL_CONFIG.app.ownershipPolicy,
    },
  }));
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [tipExpanded, setTipExpanded] = useState(true);

  const currentConfig = configs[activeTab];
  const selectedSet = useMemo(
    () => new Set<BitableScopeId>(currentConfig.scopes),
    [currentConfig.scopes]
  );

  const groupedScopes = useMemo(
    () =>
      BITABLE_RESOURCE_GROUPS.map((group) => ({
        group,
        items: BITABLE_SCOPES.filter((item) => item.group === group.id),
      })),
    []
  );

  function handleTabChange(nextValue: string) {
    if (nextValue !== "user" && nextValue !== "app") return;
    setActiveTab(nextValue);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("tab", nextValue);
      window.history.replaceState(null, "", url.toString());
    }
  }

  function setCurrentScopes(nextScopes: BitableScopeId[]) {
    setConfigs((prev) => ({
      ...prev,
      [activeTab]: {
        ...prev[activeTab],
        scopes: nextScopes,
      },
    }));
  }

  function toggleScope(scopeId: BitableScopeId, checked: boolean) {
    if (checked) {
      setCurrentScopes(
        addScopesWithDependencies(currentConfig.scopes, [scopeId])
      );
    } else {
      setCurrentScopes(
        removeScopesWithDependents(currentConfig.scopes, [scopeId])
      );
    }
  }

  function toggleGroup(groupId: BitableResourceGroupId, checked: boolean) {
    const groupScopeIds = BITABLE_SCOPES.filter(
      (item) => item.group === groupId
    ).map((item) => item.scope);
    if (checked) {
      setCurrentScopes(
        addScopesWithDependencies(currentConfig.scopes, groupScopeIds)
      );
    } else {
      setCurrentScopes(
        removeScopesWithDependents(currentConfig.scopes, groupScopeIds)
      );
    }
  }

  function handleResetCurrent() {
    const fallback = DEFAULT_PRINCIPAL_CONFIG[activeTab];
    setConfigs((prev) => ({
      ...prev,
      [activeTab]: {
        scopes: [...fallback.scopes],
        ownershipPolicy: fallback.ownershipPolicy,
      },
    }));
    toast.success("已恢复默认配置");
  }

  function handleSave() {
    // 后端持久化接口接入点：{ principal: activeTab, ...currentConfig }
    toast.success(`已保存 ${currentConfig.scopes.length} 项权限配置`);
  }

  async function copyText(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(text);
      toast.success(`已复制 ${label}`);
      window.setTimeout(() => {
        setCopiedKey((current) => (current === text ? null : current));
      }, 1500);
    } catch {
      toast.error("复制失败");
    }
  }

  const scopeString = currentConfig.scopes.join(" ");

  function isPresetActive(target: readonly BitableScopeId[]): boolean {
    if (currentConfig.scopes.length !== target.length) return false;
    return target.every((id) => selectedSet.has(id));
  }

  const isReadonlyActive = isPresetActive(READONLY_BITABLE_SCOPE_IDS);
  const isWriteActive = isPresetActive(STANDARD_WRITE_BITABLE_SCOPE_IDS);
  const isAllActive = isPresetActive(ALL_BITABLE_SCOPE_IDS);
  const isEmptyActive = currentConfig.scopes.length === 0;

  function renderPanel() {
    return (
      <div className="flex flex-col gap-3">
        <div className="overflow-hidden rounded-md border border-border bg-table-body">
          <div className="divide-y divide-border">
            {groupedScopes.map(({ group, items }) => {
              const selectedInGroup = items.filter((item) =>
                selectedSet.has(item.scope)
              ).length;
              const allChecked =
                items.length > 0 && selectedInGroup === items.length;
              const someChecked =
                selectedInGroup > 0 && selectedInGroup < items.length;
              const parentLabel = GROUP_PARENT_LABELS[group.id];

              return (
                <section key={group.id} aria-label={group.label}>
                  <div className="flex h-10 items-center bg-table-header px-4">
                    <label className="flex cursor-pointer items-center gap-2.5 text-sm">
                      <Checkbox
                        checked={allChecked}
                        indeterminate={someChecked}
                        aria-label={`全选${group.label}权限`}
                        onCheckedChange={(checked) =>
                          toggleGroup(group.id, Boolean(checked))
                        }
                      />
                      {GROUP_ICONS[group.id]}
                      <span className="flex items-center gap-1.5">
                        {parentLabel && (
                          <>
                            <span className="font-normal text-muted-foreground">
                              {parentLabel}
                            </span>
                            <span
                              className="text-muted-foreground/60"
                              aria-hidden="true"
                            >
                              /
                            </span>
                          </>
                        )}
                        <span className="font-medium text-foreground">
                          {group.label}
                        </span>
                      </span>
                    </label>
                  </div>

                  <div className="divide-y divide-border border-t border-border">
                    {items.map((item) => {
                      const checked = selectedSet.has(item.scope);
                      const isCopied = copiedKey === item.scope;

                      return (
                        <div
                          key={item.scope}
                          className="group flex h-10 items-center justify-between gap-4 pr-4 pl-10 text-sm transition-colors hover:bg-muted/35"
                        >
                          <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2.5">
                            <Checkbox
                              checked={checked}
                              onCheckedChange={(nextChecked) =>
                                toggleScope(item.scope, Boolean(nextChecked))
                              }
                            />
                            <span className="truncate text-foreground">
                              {item.name}
                            </span>
                          </label>

                          <div className="flex shrink-0 items-center gap-4">
                            <button
                              type="button"
                              onClick={() =>
                                void copyText(item.scope, item.scope)
                              }
                              title="复制 Scope"
                              className="inline-flex w-52 items-center justify-between rounded px-2 py-0.5 font-mono text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground cursor-pointer"
                            >
                              <span className="truncate">{item.scope}</span>
                              {isCopied ? (
                                <CheckIcon
                                  className="size-3 shrink-0 text-foreground"
                                  aria-hidden="true"
                                />
                              ) : (
                                <CopyIcon
                                  className="size-3 shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
                                  aria-hidden="true"
                                />
                              )}
                            </button>

                            <span
                              className={cn(
                                "w-8 text-right text-xs",
                                item.level === "destructive"
                                  ? "text-destructive"
                                  : "text-muted-foreground"
                              )}
                            >
                              {LEVEL_LABELS[item.level]}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-md border border-blue-200/80 bg-blue-50/70 text-blue-900 dark:border-blue-900/60 dark:bg-blue-950/35 dark:text-blue-100">
        <button
          type="button"
          aria-expanded={tipExpanded}
          onClick={() => setTipExpanded((prev) => !prev)}
          className="flex w-full items-center justify-between gap-2 px-3.5 py-2.5 text-left text-sm cursor-pointer"
        >
          <span className="flex items-center gap-2 font-medium">
            <InfoIcon
              className="size-4 shrink-0 text-blue-600 dark:text-blue-400"
              aria-hidden="true"
            />
            <span>权限说明</span>
          </span>
          <ChevronDownIcon
            className={cn(
              "size-4 shrink-0 text-blue-600/80 motion-safe:transition-transform motion-safe:duration-200 ease-out dark:text-blue-400/80",
              tipExpanded && "rotate-180"
            )}
            aria-hidden="true"
          />
        </button>

        <div
          aria-hidden={!tipExpanded}
          inert={!tipExpanded}
          className={cn(
            "grid motion-safe:transition-[grid-template-rows,opacity] motion-safe:duration-200 ease-out",
            tipExpanded
              ? "grid-rows-[1fr] opacity-100"
              : "grid-rows-[0fr] opacity-0"
          )}
        >
          <div className="overflow-hidden">
            <ul className="list-disc space-y-1 px-3.5 pt-0 pb-3 pl-9 text-xs leading-relaxed text-blue-900/85 dark:text-blue-100/85">
              <li>用户权限仅对普通用户生效，管理员默认拥有多维表的全部操作权限</li>
              <li>应用权限由授权中心统一控制，不受普通用户与管理员角色约束</li>
              <li>权限按层级递进生效，勾选写入或删除权限时自动补齐上游查看权限</li>
            </ul>
          </div>
        </div>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={handleTabChange}
        className="flex flex-col gap-3"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <TabsList>
            <TabsTrigger value="user" className="px-3">
              <span>用户权限</span>
              <span className="text-xs tabular-nums text-muted-foreground">
                {configs.user.scopes.length}
              </span>
            </TabsTrigger>
            <TabsTrigger value="app" className="px-3">
              <span>应用权限</span>
              <span className="text-xs tabular-nums text-muted-foreground">
                {configs.app.scopes.length}
              </span>
            </TabsTrigger>
          </TabsList>

          <div className="flex flex-wrap items-center gap-2">
            <div
              role="group"
              aria-label="权限操作"
              data-slot="button-group"
              className="inline-flex w-fit items-stretch [&>*:not(:first-child)]:-ml-px [&>*:not(:first-child)]:rounded-l-none [&>*:not(:last-child)]:rounded-r-none [&>*:focus-visible]:relative [&>*:focus-visible]:z-10"
            >
              <Button
                variant="outline"
                size="sm"
                aria-pressed={isReadonlyActive}
                className={cn(isReadonlyActive && "bg-muted font-medium")}
                onClick={() => setCurrentScopes(READONLY_BITABLE_SCOPE_IDS)}
              >
                只读
              </Button>
              <Button
                variant="outline"
                size="sm"
                aria-pressed={isWriteActive}
                className={cn(isWriteActive && "bg-muted font-medium")}
                onClick={() =>
                  setCurrentScopes(STANDARD_WRITE_BITABLE_SCOPE_IDS)
                }
              >
                读写
              </Button>
              <Button
                variant="outline"
                size="sm"
                aria-pressed={isAllActive}
                className={cn(isAllActive && "bg-muted font-medium")}
                onClick={() => setCurrentScopes(ALL_BITABLE_SCOPE_IDS)}
              >
                全选
              </Button>
              <Button
                variant="outline"
                size="sm"
                aria-pressed={isEmptyActive}
                className={cn(isEmptyActive && "bg-muted font-medium")}
                onClick={() => setCurrentScopes([])}
              >
                清空
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={!scopeString}
                onClick={() => void copyText(scopeString, "已选 Scope")}
              >
                <CopyIcon className="size-3.5" aria-hidden="true" />
                复制
              </Button>
            </div>

            <Button variant="outline" size="sm" onClick={handleResetCurrent}>
              <RotateCcwIcon className="size-3.5" aria-hidden="true" />
              恢复默认
            </Button>
            <Button size="sm" onClick={handleSave}>
              保存配置
            </Button>
          </div>
        </div>

        <TabsContent value="user">{renderPanel()}</TabsContent>
        <TabsContent value="app">{renderPanel()}</TabsContent>
      </Tabs>
    </div>
  );
}
