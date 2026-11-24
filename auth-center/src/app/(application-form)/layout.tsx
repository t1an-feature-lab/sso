import type { ReactNode } from 'react';
import { Layout, LayoutContent } from '@astryxdesign/core/Layout';
import { VStack } from '@astryxdesign/core/VStack';

export default function ApplicationFormLayout({ children }: { children: ReactNode }) {
  return (
    <VStack as="main" minHeight="100dvh">
      <Layout height="auto" contentWidth={720}>
        <LayoutContent isScrollable={false}>{children}</LayoutContent>
      </Layout>
    </VStack>
  );
}
