import { PageHeading } from '@/components/page-heading';
import { InternalApps } from '@/components/internal-apps';
import { requireAdmin } from '@/server/auth';

export default async function InternalAppsPage() {
  await requireAdmin();
  return <><PageHeading title="内部子应用" /><InternalApps /></>;
}
