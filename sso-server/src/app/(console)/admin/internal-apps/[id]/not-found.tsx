import { Button } from '@astryxdesign/core/Button';
import { Center } from '@astryxdesign/core/Center';
import { EmptyState } from '@astryxdesign/core/EmptyState';

export default function NotFound() {
  return <Center minHeight={320} padding={4}><EmptyState title="子应用不存在" headingLevel={1} actions={<Button label="返回列表" href="/admin/internal-apps" />} /></Center>;
}
