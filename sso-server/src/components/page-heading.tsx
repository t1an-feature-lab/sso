import type { ReactNode } from 'react';
import { Button } from '@astryxdesign/core/Button';
import { Divider } from '@astryxdesign/core/Divider';
import { Heading } from '@astryxdesign/core/Heading';
import { Icon } from '@astryxdesign/core/Icon';
import { edgeCompSlot } from '@astryxdesign/core/Layout';
import { HStack, StackItem } from '@astryxdesign/core/Stack';

export function PageHeading({ title, actions, backHref }: { title: string; actions?: ReactNode; backHref?: string }) {
  return (
    <HStack as="header" gap={3} hAlign="between" vAlign="center" wrap="wrap">
      <StackItem size="fill" style={{ flexBasis: 'min(100%, 20rem)' }}>
        <HStack gap={3} vAlign="center">
          {backHref && <>
            <StackItem xstyle={edgeCompSlot.inset('var(--spacing-3)')} style={{ marginInlineEnd: 0 }}><Button label="返回" icon={<Icon icon="chevronLeft" />} variant="ghost" href={backHref} /></StackItem>
            <Divider orientation="vertical" aria-hidden style={{ height: 'var(--spacing-5)', flexShrink: 0 }} />
          </>}
          <StackItem size="fill"><Heading level={backHref ? 3 : 1} accessibilityLevel={1} maxLines={2}>{title}</Heading></StackItem>
        </HStack>
      </StackItem>
      {actions}
    </HStack>
  );
}
