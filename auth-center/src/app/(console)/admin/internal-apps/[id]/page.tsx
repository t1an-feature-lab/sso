import { notFound } from 'next/navigation';
import { Badge } from '@astryxdesign/core/Badge';
import { MetadataList, MetadataListItem } from '@astryxdesign/core/MetadataList';
import { VStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import { PageHeading } from '@/components/page-heading';
import { getInternalApplication } from '@/server/queries';

export default async function InternalAppDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const application = await getInternalApplication(id);
  if (!application) notFound();
  return (
    <>
      <PageHeading title={application.name} backHref="/admin/internal-apps" />
      <VStack as="section" maxWidth={800} aria-label="子应用详情">
        <MetadataList>
          <MetadataListItem label="应用名称">{application.name}</MetadataListItem>
          <MetadataListItem label="应用 ID"><Text type="code">{application.id}</Text></MetadataListItem>
          <MetadataListItem label="应用地址">{application.homepage || '—'}</MetadataListItem>
          <MetadataListItem label="状态"><Badge label={application.status === 'active' ? '启用' : '停用'} variant={application.status === 'active' ? 'success' : 'neutral'} /></MetadataListItem>
          <MetadataListItem label="创建时间"><time dateTime={application.createdAt}>{new Date(application.createdAt).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}</time></MetadataListItem>
        </MetadataList>
      </VStack>
    </>
  );
}
