export type PermissionPrincipal = "user" | "app";

export type BitableResourceGroupId =
  | "base"
  | "table"
  | "field"
  | "record"
  | "view";

export type ScopeAccessLevel = "read" | "write" | "destructive";

/**
 * 资源归属边界：区分用户创建与应用创建的数据库、数据表、字段及视图
 * - all: 全部资源（含用户创建与应用创建）
 * - user_created: 仅用户创建
 * - app_created: 仅应用创建
 */
export type ResourceOwnershipPolicy = "all" | "user_created" | "app_created";

export interface BitableResourceGroup {
  id: BitableResourceGroupId;
  label: string;
  parentId: BitableResourceGroupId | null;
  depth: 0 | 1 | 2;
}

export const BITABLE_RESOURCE_GROUPS: readonly BitableResourceGroup[] = [
  { id: "base", label: "数据库", parentId: null, depth: 0 },
  { id: "table", label: "数据表", parentId: "base", depth: 1 },
  { id: "field", label: "字段", parentId: "table", depth: 2 },
  { id: "record", label: "记录", parentId: "table", depth: 2 },
  { id: "view", label: "视图", parentId: "table", depth: 2 },
] as const;

export const BITABLE_SCOPES = [
  // 数据库（Base）
  {
    scope: "bitable:base:read",
    group: "base",
    name: "查看数据库",
    level: "read",
    requires: [],
  },
  {
    scope: "bitable:base:create",
    group: "base",
    name: "创建数据库",
    level: "write",
    requires: ["bitable:base:read"],
  },
  {
    scope: "bitable:base:update",
    group: "base",
    name: "编辑数据库",
    level: "write",
    requires: ["bitable:base:read"],
  },
  {
    scope: "bitable:base:delete",
    group: "base",
    name: "删除数据库",
    level: "destructive",
    requires: ["bitable:base:read"],
  },

  // 数据表（Table）
  {
    scope: "bitable:table:read",
    group: "table",
    name: "查看数据表",
    level: "read",
    requires: ["bitable:base:read"],
  },
  {
    scope: "bitable:table:create",
    group: "table",
    name: "创建数据表",
    level: "write",
    requires: ["bitable:table:read"],
  },
  {
    scope: "bitable:table:update",
    group: "table",
    name: "编辑数据表",
    level: "write",
    requires: ["bitable:table:read"],
  },
  {
    scope: "bitable:table:delete",
    group: "table",
    name: "删除数据表",
    level: "destructive",
    requires: ["bitable:table:read"],
  },

  // 字段（Field）
  {
    scope: "bitable:field:read",
    group: "field",
    name: "查看字段",
    level: "read",
    requires: ["bitable:table:read"],
  },
  {
    scope: "bitable:field:create",
    group: "field",
    name: "新增字段",
    level: "write",
    requires: ["bitable:field:read"],
  },
  {
    scope: "bitable:field:update",
    group: "field",
    name: "编辑字段",
    level: "write",
    requires: ["bitable:field:read"],
  },
  {
    scope: "bitable:field:delete",
    group: "field",
    name: "删除字段",
    level: "destructive",
    requires: ["bitable:field:read"],
  },

  // 记录（Record）
  {
    scope: "bitable:record:read",
    group: "record",
    name: "查看记录",
    level: "read",
    requires: ["bitable:table:read"],
  },
  {
    scope: "bitable:record:create",
    group: "record",
    name: "新增记录",
    level: "write",
    requires: ["bitable:record:read"],
  },
  {
    scope: "bitable:record:update",
    group: "record",
    name: "编辑记录",
    level: "write",
    requires: ["bitable:record:read"],
  },
  {
    scope: "bitable:record:delete",
    group: "record",
    name: "删除记录",
    level: "destructive",
    requires: ["bitable:record:read"],
  },

  // 视图（View）
  {
    scope: "bitable:view:read",
    group: "view",
    name: "查看视图",
    level: "read",
    requires: ["bitable:table:read"],
  },
  {
    scope: "bitable:view:create",
    group: "view",
    name: "创建视图",
    level: "write",
    requires: ["bitable:view:read"],
  },
  {
    scope: "bitable:view:update",
    group: "view",
    name: "编辑视图",
    level: "write",
    requires: ["bitable:view:read"],
  },
  {
    scope: "bitable:view:delete",
    group: "view",
    name: "删除视图",
    level: "destructive",
    requires: ["bitable:view:read"],
  },
] as const satisfies readonly {
  scope: string;
  group: BitableResourceGroupId;
  name: string;
  level: ScopeAccessLevel;
  requires: readonly string[];
}[];

export type BitableScopeId = (typeof BITABLE_SCOPES)[number]["scope"];

export const ALL_BITABLE_SCOPE_IDS: BitableScopeId[] = BITABLE_SCOPES.map(
  (item) => item.scope
);

export const READONLY_BITABLE_SCOPE_IDS: BitableScopeId[] = BITABLE_SCOPES.filter(
  (item) => item.level === "read"
).map((item) => item.scope);

export const STANDARD_WRITE_BITABLE_SCOPE_IDS: BitableScopeId[] =
  BITABLE_SCOPES.filter((item) => item.level !== "destructive").map(
    (item) => item.scope
  );

const SCOPE_REQUIRES_MAP = new Map<BitableScopeId, readonly BitableScopeId[]>(
  BITABLE_SCOPES.map((item) => [
    item.scope,
    item.requires as readonly BitableScopeId[],
  ])
);

/** 选中若干 scope 时，递归补齐其所有前置依赖 */
export function addScopesWithDependencies(
  current: readonly BitableScopeId[],
  toAdd: readonly BitableScopeId[]
): BitableScopeId[] {
  const next = new Set<BitableScopeId>(current);
  const queue = [...toAdd];
  while (queue.length > 0) {
    const id = queue.shift()!;
    if (next.has(id)) continue;
    next.add(id);
    const deps = SCOPE_REQUIRES_MAP.get(id) ?? [];
    for (const dep of deps) {
      if (!next.has(dep)) queue.push(dep);
    }
  }
  return ALL_BITABLE_SCOPE_IDS.filter((id) => next.has(id));
}

/** 取消若干 scope 时，递归移除所有依赖它们的下级 scope */
export function removeScopesWithDependents(
  current: readonly BitableScopeId[],
  toRemove: readonly BitableScopeId[]
): BitableScopeId[] {
  const removed = new Set<BitableScopeId>(toRemove);
  let changed = true;
  while (changed) {
    changed = false;
    for (const item of BITABLE_SCOPES) {
      if (removed.has(item.scope)) continue;
      const deps = SCOPE_REQUIRES_MAP.get(item.scope) ?? [];
      if (deps.some((dep) => removed.has(dep))) {
        removed.add(item.scope);
        changed = true;
      }
    }
  }
  return current.filter((id) => !removed.has(id));
}

export interface PrincipalPermissionConfig {
  scopes: BitableScopeId[];
  ownershipPolicy: ResourceOwnershipPolicy;
}

export const DEFAULT_PRINCIPAL_CONFIG: Record<
  PermissionPrincipal,
  PrincipalPermissionConfig
> = {
  user: {
    scopes: [...STANDARD_WRITE_BITABLE_SCOPE_IDS],
    ownershipPolicy: "all",
  },
  app: {
    scopes: [
      "bitable:base:read",
      "bitable:table:read",
      "bitable:table:create",
      "bitable:table:update",
      "bitable:field:read",
      "bitable:field:create",
      "bitable:field:update",
      "bitable:record:read",
      "bitable:record:create",
      "bitable:record:update",
      "bitable:view:read",
    ],
    ownershipPolicy: "app_created",
  },
};

export const OWNERSHIP_POLICY_OPTIONS: Record<
  PermissionPrincipal,
  { value: ResourceOwnershipPolicy; label: string }[]
> = {
  user: [
    { value: "all", label: "全部资源" },
    { value: "user_created", label: "仅用户创建" },
  ],
  app: [
    { value: "app_created", label: "仅应用创建" },
    { value: "all", label: "全部资源" },
  ],
};
