"use client";

import { Layout, LayoutContent } from "@astryxdesign/core/Layout";
import { Center } from "@astryxdesign/core/Center";
import { EmptyState } from "@astryxdesign/core/EmptyState";
import { Icon } from "@astryxdesign/core/Icon";
import { GlobeAltIcon } from "@heroicons/react/24/outline";
import { WorkspaceHeader } from "@/components/workspace-header";

export function SitesView() {
  return (
    <Layout
      height="fill"
      header={<WorkspaceHeader title="我的站点" />}
      content={
        <LayoutContent>
          <Center axis="both" height="100%">
            <EmptyState
              headingLevel={1}
              title="我的站点"
              icon={<Icon icon={GlobeAltIcon} size="lg" />}
            />
          </Center>
        </LayoutContent>
      }
    />
  );
}
