import { PageHeading } from '@/components/page-heading';
import { Applications } from '@/components/applications';
import { requireAdmin } from '@/server/auth';
import { getApplications } from '@/server/queries';

export default async function ApplicationsPage() {
  const user = await requireAdmin();
  const applications = await getApplications(user, 'all');
  return (
    <>
      <PageHeading title="应用管理" />
      <Applications applications={applications} admin />
    </>
  );
}
