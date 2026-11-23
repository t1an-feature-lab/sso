import { PageHeading } from '@/components/page-heading';
import { UsersTable } from '@/components/users-table';
import { requireAdmin } from '@/server/auth';
import { getUsers } from '@/server/queries';

export default async function UsersPage() {
  const currentUser = await requireAdmin();
  const users = await getUsers();
  return (
    <>
      <PageHeading title="用户与权限" />
      <UsersTable users={users} currentUserId={currentUser.id} />
    </>
  );
}
