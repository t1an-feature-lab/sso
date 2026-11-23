"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertDialog } from "@astryxdesign/core/AlertDialog";
import { Avatar } from "@astryxdesign/core/Avatar";
import { Button } from "@astryxdesign/core/Button";
import { Card } from "@astryxdesign/core/Card";
import { EmptyState } from "@astryxdesign/core/EmptyState";
import { Icon } from "@astryxdesign/core/Icon";
import { Selector } from "@astryxdesign/core/Selector";
import { HStack, StackItem, VStack } from "@astryxdesign/core/Stack";
import { Table, pixel, proportional, type TableColumn } from "@astryxdesign/core/Table";
import { Text } from "@astryxdesign/core/Text";
import { TextInput } from "@astryxdesign/core/TextInput";
import { useAppToast } from "@/components/app-toast";
import type { AuthorizedApplicationUser, ClientApplicationDetail } from "@/common/types";
import { TablePager, useTablePage } from "@/components/table-pagination";
import { revokeAllApplicationTokensAction } from "@/server/actions";

const dateFormatter = new Intl.DateTimeFormat("zh-CN", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Shanghai",
});

export function ApplicationAuthorizations({ application, admin = false }: { application: ClientApplicationDetail; admin?: boolean }) {
  const router = useRouter();
  const toast = useAppToast();
  const [confirmRevoke, setConfirmRevoke] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const [isRefreshing, startRefresh] = useTransition();
  const [search, setSearch] = useState("");
  const [scope, setScope] = useState("");
  const actionInFlight = useRef(false);
  const query = search.trim().toLocaleLowerCase();
  const filtered = application.authorizedUsers.filter((user) =>
    [user.username, user.phone ?? ""].some((value) => value.toLocaleLowerCase().includes(query)) &&
    (!admin || !scope || user.scopes.includes(scope)),
  );
  const scopes = [...new Set(application.authorizedUsers.flatMap((user) => user.scopes))].sort();
  const pagination = useTablePage(filtered);
  const userCount = new Set(application.authorizedUsers.map((user) => user.userId)).size;
  const pending = revoking || isRefreshing;

  function clearFilters() {
    setSearch("");
    setScope("");
    pagination.resetPage();
  }

  async function revokeTokens() {
    if (pending || actionInFlight.current || userCount === 0) return;
    actionInFlight.current = true;
    setRevoking(true);
    const data = new FormData();
    data.set("id", application.id);
    try {
      const result = await revokeAllApplicationTokensAction({}, data);
      if (result.error) {
        toast({ body: result.error, type: "error", uniqueID: "application-tokens-revoke" });
        return;
      }
      setConfirmRevoke(false);
      pagination.resetPage();
      toast({ body: result.success ?? "全部用户令牌已撤销", uniqueID: "application-tokens-revoke" });
      startRefresh(() => router.refresh());
    } catch {
      toast({ body: "撤销失败，请稍后重试", type: "error", uniqueID: "application-tokens-revoke" });
    } finally {
      actionInFlight.current = false;
      setRevoking(false);
    }
  }

  const columns: TableColumn<AuthorizedApplicationUser>[] = [
    {
      key: "username",
      header: "用户",
      width: proportional(1, { minWidth: 160 }),
      renderCell: (user) => (
        <HStack gap={3} vAlign="center">
          <Avatar name={user.username} size="md" tooltip={false} />
          <StackItem size="fill">
            <VStack gap={0.5}>
              <Text type="label" maxLines={1} style={{ minInlineSize: 0, maxInlineSize: "15rem" }}>{user.username}</Text>
              {user.phone && <Text type="supporting" maxLines={1} style={{ minInlineSize: 0, maxInlineSize: "20rem" }} hasTabularNumbers>{user.phone}</Text>}
            </VStack>
          </StackItem>
        </HStack>
      ),
    },
    {
      key: "scopes",
      header: "权限",
      width: proportional(1, { minWidth: 150 }),
      renderCell: (user) => <Text type="supporting" maxLines={1} style={{ minInlineSize: 0, maxInlineSize: "20rem" }}>{user.scopes.length ? user.scopes.join(" ") : "—"}</Text>,
    },
    {
      key: "authorizedAt",
      header: "授权时间",
      width: pixel(150),
      renderCell: (user) => (
        <Text type="supporting" maxLines={1} style={{ minInlineSize: 0, maxInlineSize: "20rem" }}><time dateTime={user.authorizedAt}>{dateFormatter.format(new Date(user.authorizedAt))}</time></Text>
      ),
    },
    {
      key: "lastUsedAt",
      header: "最近使用",
      width: pixel(150),
      renderCell: (user) => (
        <Text type="supporting" maxLines={1} style={{ minInlineSize: 0, maxInlineSize: "20rem" }}>
          {user.lastUsedAt
            ? <time dateTime={user.lastUsedAt}>{dateFormatter.format(new Date(user.lastUsedAt))}</time>
            : "从未使用"}
        </Text>
      ),
    },
  ];

  return (
    <VStack as="section" gap={4} aria-label="授权用户" aria-busy={pending}>
      <HStack gap={3} hAlign="between" vAlign="center" wrap="wrap">
        <HStack gap={3} vAlign="center" wrap="wrap" maxWidth="100%">
          <VStack className="search-field">
            <TextInput
              label="搜索授权用户"
              type="search"
              isLabelHidden
              value={search}
              onChange={(value) => { setSearch(value); pagination.resetPage(); }}
              placeholder="搜索用户名或手机号"
              startIcon={<Icon icon="search" size="sm" />}
              hasClear
              width="100%"
            />
          </VStack>
          {admin && scopes.length > 0 && <Selector
            label="权限筛选"
            isLabelHidden
            value={scope}
            onChange={(value) => { setScope(value); pagination.resetPage(); }}
            options={[{ value: "", label: "全部权限" }, ...scopes.map((value) => ({ value, label: value }))]}
            width={160}
          />}
        </HStack>
        <Button
          label="撤销全部用户令牌"
          variant="destructive"
          isDisabled={pending || userCount === 0}
          onClick={() => setConfirmRevoke(true)}
        />
      </HStack>
      <Card padding={0}>
        <Table
          aria-label="应用授权用户"
          data={pagination.data}
          columns={columns}
          idKey="id"
          rowIndexStart={pagination.rowIndexStart}
          rowCount={filtered.length}
          density="balanced"
          textOverflow="truncate"
          hasHover
          emptyState={<EmptyState
            title={application.authorizedUsers.length ? "没有匹配的用户" : "暂无授权用户"}
            actions={query || scope ? <Button label="清空筛选" onClick={clearFilters} /> : undefined}
          />}
        />
      </Card>
      <TablePager {...pagination.controls} label="授权用户分页" />
      <AlertDialog
        isOpen={confirmRevoke}
        onOpenChange={(open) => { if (!pending) setConfirmRevoke(open); }}
        title="撤销全部用户令牌？"
        description={`此应用的 ${userCount} 位用户需要重新授权后才能继续访问`}
        actionLabel="撤销全部令牌"
        cancelLabel="取消"
        onAction={revokeTokens}
        isActionLoading={revoking}
      />
    </VStack>
  );
}
