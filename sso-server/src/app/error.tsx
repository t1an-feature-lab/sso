'use client';

import { Button } from '@astryxdesign/core/Button';
import { Center } from '@astryxdesign/core/Center';
import { EmptyState } from '@astryxdesign/core/EmptyState';
import { useAppToast } from '@/components/app-toast';

export default function ErrorPage({ reset }: { reset: () => void }) {
  const toast = useAppToast();
  return <Center minHeight="100dvh" padding={4}><EmptyState title="页面暂时无法加载" headingLevel={1} actions={<Button label="重试" variant="primary" onClick={() => { toast({ body: '正在重新加载', type: 'info' }); reset(); }} />} /></Center>;
}
