"use client";

import { useId } from "react";
import { Avatar } from "@astryxdesign/core/Avatar";
import { Button } from "@astryxdesign/core/Button";
import { Card } from "@astryxdesign/core/Card";
import { Divider } from "@astryxdesign/core/Divider";
import { EmptyState } from "@astryxdesign/core/EmptyState";
import { HStack } from "@astryxdesign/core/HStack";
import { Icon } from "@astryxdesign/core/Icon";
import { edgeCompSlot } from "@astryxdesign/core/Layout";
import { Link } from "@astryxdesign/core/Link";
import { List, ListItem } from "@astryxdesign/core/List";
import { StackItem } from "@astryxdesign/core/Stack";
import { Tab, TabList } from "@astryxdesign/core/TabList";
import { VStack } from "@astryxdesign/core/VStack";
import type { ClientApplication } from "@/common/types";
import { TablePager, useTablePage } from "@/components/table-pagination";
import { useUrlTab } from "@/components/use-url-tab";

const protocolNames = { oauth: "OAuth 2.0", oidc: "OpenID Connect" };

export function ConsoleApplications({
  applications,
}: {
  applications: ClientApplication[];
}) {
  const panelId = useId();
  const [protocol, setProtocol] = useUrlTab("protocol", ["oauth", "oidc"], "oauth");
  const visible = applications.filter((application) => application.protocol === protocol);
  const pagination = useTablePage(visible);
  const applyHref = `/applications/new?protocol=${protocol}`;

  return (
    <VStack as="section" gap={4} aria-label="应用列表">
      <HStack gap={3} vAlign="start" style={{ position: "relative" }}>
        <Divider isFullBleed aria-hidden style={{ position: "absolute", insetInlineStart: 0, insetBlockEnd: 0 }} />
        <StackItem size="fill" xstyle={edgeCompSlot.inset("var(--spacing-3)")} style={{ marginInlineEnd: 0 }}>
          <TabList
            value={protocol}
            onChange={(value) => {
              setProtocol(value);
              pagination.resetPage();
            }}
            role="tablist"
            aria-label="应用协议"
            hasDivider
          >
            <Tab value="oauth" label="OAuth 2.0" panelId={panelId + "-oauth"} />
            <Tab value="oidc" label="OpenID Connect" panelId={panelId + "-oidc"} />
          </TabList>
        </StackItem>
        {visible.length > 0 && <HStack minHeight="var(--size-element-md)" vAlign="center">
          <Link href={applyHref} type="label">申请应用</Link>
        </HStack>}
      </HStack>
      {(["oauth", "oidc"] as const).map((value) => (
        <div key={value} id={panelId + "-" + value} role="tabpanel" aria-label={protocolNames[value]} hidden={protocol !== value} tabIndex={0}>
          {protocol === value && (visible.length > 0 ? (
            <VStack gap={4}>
              <Card padding={0}>
                <List density="spacious" hasDividers aria-label={`${protocolNames[protocol]}应用`}>
                  {pagination.data.map((application) => {
                    const href = `/applications/${application.id}`;
                    return (
                      <ListItem
                        key={application.id}
                        startContent={<Avatar src={application.logoUrl || undefined} name={application.name} size="lg" shape="rounded" tooltip={false} />}
                        label={<Link href={href} type="label" maxLines={1}>{application.name}</Link>}
                        endContent={<Button label="配置" aria-label={`配置 ${application.name}`} size="sm" href={href} />}
                      />
                    );
                  })}
                </List>
              </Card>
              {visible.length > 10 && <TablePager {...pagination.controls} label={`${protocolNames[protocol]}应用分页`} />}
            </VStack>
          ) : (
            <EmptyState
              title={`暂无 ${protocolNames[protocol]} 应用`}
              description="申请一个应用，开始接入统一身份认证"
              headingLevel={2}
              icon={<Icon icon="wrench" size="lg" />}
              actions={<Button label="申请应用" variant="primary" href={applyHref} />}
            />
          ))}
        </div>
      ))}
    </VStack>
  );
}
