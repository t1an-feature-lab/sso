import { PageHeading } from '@/components/page-heading';
import { InternalApps } from '@/components/internal-apps';
import { getInternalApplications } from '@/server/queries';

export default async function InternalAppsPage() {
  const applications = await getInternalApplications();
  return <><PageHeading title="内部子应用" /><InternalApps applications={applications} /></>;
}
