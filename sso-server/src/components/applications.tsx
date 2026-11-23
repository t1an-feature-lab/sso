"use client";

import { useId, useState } from "react";
import { Badge } from "@astryxdesign/core/Badge";
import { Avatar } from "@astryxdesign/core/Avatar";
import { Button } from "@astryxdesign/core/Button";
import { Card } from "@astryxdesign/core/Card";
import { EmptyState } from "@astryxdesign/core/EmptyState";
import { HStack } from "@astryxdesign/core/HStack";
import { Icon } from "@astryxdesign/core/Icon";
import { Selector } from "@astryxdesign/core/Selector";
import { StackItem } from "@astryxdesign/core/Stack";
import { Table, pixel, proportional, type TableColumn } from "@astryxdesign/core/Table";
import { Tab, TabList } from "@astryxdesign/core/TabList";
import { Text } from "@astryxdesign/core/Text";
import { TextInput } from "@astryxdesign/core/TextInput";
import { VStack } from "@astryxdesign/core/VStack";
import type { ClientApplication } from "@/common/types";
import { TablePager, useTablePage } from "@/components/table-pagination";
import { useUrlTab } from "@/components/use-url-tab";

const protocolNames = { oauth: "OAuth 2.0", oidc: "OpenID Connect" };
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
  const panelId = useId();
  const [protocol, setProtocol] = useUrlTab("protocol", ["oauth", "oidc"], "oauth");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const applicationPath = admin ? "/admin/applications" : "/applications";
  const applyHref = `${applicationPath}/new?protocol=${protocol}`;
  const query = search.trim().toLocaleLowerCase();
  const hasFilters = Boolean(query) || (admin && status !== "all");
  const visible = applications.filter((application) => {
    return application.protocol === protocol &&
      (!admin || status === "all" || application.status === status) &&
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
      width: pixel(92),
      align: "end",
      renderCell: (application) => (
        <Button
          label="配置"
          variant="ghost"
          size="sm"
          href={`${applicationPath}/${application.id}`}
        />
      ),
    },
  ];

  return (
    <VStack as="section" gap={4} aria-label="应用列表">
      <TabList value={protocol} onChange={(value) => {
        setProtocol(value);
        pagination.resetPage();
      }} role="tablist" aria-label="应用协议" hasDivider isFullBleed>
        <Tab value="oauth" label="OAuth 2.0" panelId={panelId + "-oauth"} />
        <Tab value="oidc" label="OpenID Connect" panelId={panelId + "-oidc"} />
      </TabList>
      {(["oauth", "oidc"] as const).map((value) => (
        <div key={value} id={panelId + "-" + value} role="tabpanel" aria-label={protocolNames[value]} hidden={protocol !== value} tabIndex={0}>
          {protocol === value && (
            <VStack gap={4}>
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
                  aria-label={`${protocolNames[protocol]}应用`}
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
                      title={hasFilters ? "未找到匹配的应用" : `暂无 ${protocolNames[protocol]} 应用`}
                      icon={<Icon icon="wrench" size="lg" />}
                      actions={hasFilters
                        ? <Button label={admin ? "清空筛选" : "清空搜索"} onClick={clearFilters} />
                        : !admin && <Button label="申请应用" href={applyHref} />}
                    />
                  }
                />
              </Card>
              <TablePager {...pagination.controls} label={`${protocolNames[protocol]}应用分页`} />
            </VStack>
          )}
        </div>
      ))}
    </VStack>
  );
}
