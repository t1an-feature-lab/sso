"use client";

import { Avatar } from "@astryxdesign/core/Avatar";
import { Button } from "@astryxdesign/core/Button";
import { Card } from "@astryxdesign/core/Card";
import { EmptyState } from "@astryxdesign/core/EmptyState";
import { Icon } from "@astryxdesign/core/Icon";
import { Link } from "@astryxdesign/core/Link";
import { List, ListItem } from "@astryxdesign/core/List";
import { VStack } from "@astryxdesign/core/VStack";
import type { ClientApplication } from "@/common/types";
import { TablePager, useTablePage } from "@/components/table-pagination";
import { useRemoveSearchParam } from "@/components/use-url-tab";

const applyHref = "/applications/new";

export function ConsoleApplications({
  applications,
}: {
  applications: ClientApplication[];
}) {
  useRemoveSearchParam("protocol");
  const pagination = useTablePage(applications);

  if (!applications.length) {
    return (
      <EmptyState
        title="暂无应用"
        description="申请一个应用，开始接入统一身份认证"
        headingLevel={2}
        icon={<Icon icon="wrench" size="lg" />}
        actions={<Button label="申请应用" variant="primary" href={applyHref} />}
      />
    );
  }

  return (
    <VStack as="section" gap={4} aria-label="应用列表">
      <Card padding={0}>
        <List density="spacious" hasDividers aria-label="应用">
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
      {applications.length > 10 && <TablePager {...pagination.controls} label="应用分页" />}
    </VStack>
  );
}
