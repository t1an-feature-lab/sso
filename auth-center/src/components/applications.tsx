"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertDialog } from "@astryxdesign/core/AlertDialog";
import { Badge } from "@astryxdesign/core/Badge";
import { Avatar } from "@astryxdesign/core/Avatar";
import { Button } from "@astryxdesign/core/Button";
import { Card } from "@astryxdesign/core/Card";
import { DropdownMenu, DropdownMenuDivider, DropdownMenuItem } from "@astryxdesign/core/DropdownMenu";
import { EmptyState } from "@astryxdesign/core/EmptyState";
import { HStack } from "@astryxdesign/core/HStack";
import { Icon } from "@astryxdesign/core/Icon";
import { Selector } from "@astryxdesign/core/Selector";
import { StackItem } from "@astryxdesign/core/Stack";
import { Table, pixel, proportional, type TableColumn } from "@astryxdesign/core/Table";
import { Text } from "@astryxdesign/core/Text";
import { TextInput } from "@astryxdesign/core/TextInput";
import { VStack } from "@astryxdesign/core/VStack";
import type { ClientApplication } from "@/common/types";
import { useAppToast } from "@/components/app-toast";
import { TablePager, useTablePage } from "@/components/table-pagination";
import { useRemoveSearchParam } from "@/components/use-url-tab";
import { deleteApplicationAction, setApplicationStatusAction } from "@/server/application/actions";

const dateFormatter = new Intl.DateTimeFormat("zh-CN", {
  dateStyle: "medium",
  timeZone: "Asia/Shanghai",
});

export function Applications({
  applications,
  admin = false,
}: {
  applications: ClientApplication[];
  admin?: boolean;
}) {
  useRemoveSearchParam("protocol");
  const router = useRouter();
  const toast = useAppToast();
  const [confirmation, setConfirmation] = useState<{ application: ClientApplication; type: "status" | "delete" } | null>(null);
  const [pending, setPending] = useState(false);
  const actionInFlight = useRef(false);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const applicationPath = admin ? "/admin/applications" : "/applications";
  const applyHref = `${applicationPath}/new`;
  const query = search.trim().toLocaleLowerCase();
  const hasFilters = Boolean(query) || (admin && status !== "all");
  const visible = applications.filter((application) => {
    return (!admin || status === "all" || application.status === status) &&
      [application.name, application.clientId, application.ownerName].some((value) =>
        value.toLocaleLowerCase().includes(query),
      );
  });
  const pagination = useTablePage(visible);

  function changeSearch(value: string) {
    setSearch(value);
    pagination.resetPage();
  }

  function clearFilters() {
    setSearch("");
    setStatus("all");
    pagination.resetPage();
  }

  function openAction(application: ClientApplication, type: "status" | "delete") {
    if (pending || actionInFlight.current) return;
    setConfirmation({ application, type });
  }

  async function confirmAction() {
    if (!confirmation || pending || actionInFlight.current) return;
    const { application, type } = confirmation;
    actionInFlight.current = true;
    setPending(true);
    const data = new FormData();
    data.set("id", application.id);
    if (type === "status") data.set("status", application.status === "active" ? "disabled" : "active");
    try {
      const result = await (type === "delete" ? deleteApplicationAction : setApplicationStatusAction)({}, data);
      if (result.error) {
        toast({ body: result.error, type: "error", uniqueID: "application-action" });
        return;
      }
      setConfirmation(null);
      toast({
        body: result.success ?? (type === "delete" ? "应用已删除" : application.status === "active" ? "应用已停用" : "应用已启用"),
        uniqueID: "application-action",
      });
      router.refresh();
    } catch {
      toast({ body: type === "delete" ? "删除失败，请稍后重试" : "状态更新失败，请稍后重试", type: "error", uniqueID: "application-action" });
    } finally {
      actionInFlight.current = false;
      setPending(false);
    }
  }

  const columns: TableColumn<ClientApplication>[] = [
    {
      key: "name",
      header: "应用名称",
      width: proportional(1.5, { minWidth: 180 }),
      renderCell: (application) => (
        <HStack gap={2} vAlign="center">
          <Avatar src={application.logoUrl || undefined} name={application.name} size="sm" shape="rounded" tooltip={false} />
          <StackItem size="fill"><Text type="label" maxLines={1} style={{ minInlineSize: 0, maxInlineSize: "15rem" }}>{application.name}</Text></StackItem>
        </HStack>
      ),
    },
    {
      key: "clientId",
      header: "Client ID",
      width: proportional(2, { minWidth: 220 }),
      renderCell: (application) => <Text type="code" maxLines={1} style={{ minInlineSize: 0, maxInlineSize: "20rem" }}>{application.clientId}</Text>,
    },
    ...(admin ? [{
      key: "ownerName",
      header: "申请人",
      width: proportional(1, { minWidth: 130 }),
      renderCell: (application: ClientApplication) => <Text maxLines={1} style={{ minInlineSize: 0, maxInlineSize: "15rem" }}>{application.ownerName}</Text>,
    }] : []),
    {
      key: "status",
      header: "状态",
      width: pixel(100),
      renderCell: (application) => (
        <Badge
          label={application.status === "active" ? "已启用" : "已停用"}
          variant={application.status === "active" ? "success" : "neutral"}
        />
      ),
    },
    {
      key: "createdAt",
      header: "申请时间",
      width: pixel(140),
      renderCell: (application) => <Text maxLines={1} style={{ minInlineSize: 0, maxInlineSize: "20rem" }}>{dateFormatter.format(new Date(application.createdAt))}</Text>,
    },
    {
      key: "actions",
      header: "操作",
      width: pixel(admin ? 72 : 92),
      align: "end",
      renderCell: (application) => admin ? (
        <DropdownMenu
          button={{ label: `${application.name} 的操作`, icon: <Icon icon="moreHorizontal" />, isIconOnly: true, variant: "ghost", size: "sm", isDisabled: pending }}
          hasChevron={false}
          alignment="end"
          menuWidth={160}
        >
          <DropdownMenuItem
            label={application.status === "active" ? "禁用" : "启用"}
            onClick={() => openAction(application, "status")}
          />
          <DropdownMenuDivider />
          <DropdownMenuItem label="删除" variant="destructive" onClick={() => openAction(application, "delete")} />
        </DropdownMenu>
      ) : (
        <Button label="配置" variant="ghost" size="sm" href={`${applicationPath}/${application.id}`} />
      ),
    },
  ];

  return (
    <VStack as="section" gap={4} aria-label="应用列表">
      <HStack gap={3} vAlign="center" hAlign="between" wrap="wrap">
        <HStack gap={3} vAlign="center" wrap="wrap" maxWidth="100%">
          <VStack className="search-field">
            <TextInput
              label="搜索应用"
              isLabelHidden
              type="search"
              value={search}
              onChange={changeSearch}
              placeholder={admin ? "搜索应用名称、Client ID 或申请人" : "搜索应用名称或 Client ID"}
              startIcon={<Icon icon="search" size="sm" />}
              hasClear
              width="100%"
            />
          </VStack>
          {admin && <Selector label="应用状态" isLabelHidden value={status} width={130}
            onChange={(value) => { setStatus(value); pagination.resetPage(); }}
            options={[{ value: "all", label: "全部状态" }, { value: "active", label: "已启用" }, { value: "disabled", label: "已停用" }]} />}
        </HStack>
        {!admin && <Button label="申请应用" variant="primary" href={applyHref} />}
      </HStack>
      <Card padding={0}>
        <Table
          aria-label="应用"
          data={pagination.data}
          rowIndexStart={pagination.rowIndexStart}
          rowCount={visible.length}
          columns={columns}
          idKey="id"
          hasHover
          density="balanced"
          textOverflow="truncate"
          emptyState={
            <EmptyState
              title={hasFilters ? "未找到匹配的应用" : "暂无应用"}
              icon={<Icon icon="wrench" size="lg" />}
              actions={hasFilters
                ? <Button label={admin ? "清空筛选" : "清空搜索"} onClick={clearFilters} />
                : !admin && <Button label="申请应用" href={applyHref} />}
            />
          }
        />
      </Card>
      <TablePager {...pagination.controls} label="应用分页" />
      <AlertDialog
        isOpen={confirmation !== null}
        onOpenChange={(open) => { if (!actionInFlight.current && !open) setConfirmation(null); }}
        title={confirmation?.type === "delete" ? "删除这个应用？" : confirmation?.application.status === "active" ? "禁用这个应用？" : "启用这个应用？"}
        description={confirmation?.type === "delete"
          ? `将删除“${confirmation.application.name}”及其配置`
          : confirmation?.application.status === "active"
            ? `“${confirmation?.application.name ?? ""}”停用后不能继续被授权`
            : `“${confirmation?.application.name ?? ""}”启用后可以继续被授权`}
        actionLabel={confirmation?.type === "delete" ? "删除应用" : confirmation?.application.status === "active" ? "禁用" : "启用"}
        cancelLabel="取消"
        onAction={confirmAction}
        isActionLoading={pending}
      />
    </VStack>
  );
}
