import { PageHeading } from '@/components/page-heading';
import { ConsoleApplications } from '@/components/console-applications';
import { requireUser } from '@/server/auth';
import { getApplications } from '@/server/queries';

export default async function HomePage() {
  const user = await requireUser();
  const applications = await getApplications(user);
  return (
    <>
      <PageHeading title="我的应用" />
      <ConsoleApplications applications={applications} />
    </>
  );
}
