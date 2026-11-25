import { Button } from '@astryxdesign/core/Button';
import { PageHeading } from '@/components/page-heading';
import { ConsoleApplications } from '@/components/console-applications';
import { requireUser } from '@/server/auth';
import { getApplications } from '@/server/application/queries';

export default async function HomePage() {
  const user = await requireUser();
  const applications = await getApplications(user);
  return (
    <>
      <PageHeading
        title="我的应用"
        actions={applications.length > 0 ? <Button label="申请应用" variant="primary" href="/applications/new" /> : undefined}
      />
      <ConsoleApplications applications={applications} />
    </>
  );
}
