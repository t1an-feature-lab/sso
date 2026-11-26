import { UsersPermissionView } from "@/components/permissions/users-permission-view";
import { listUsersPage, requireAdmin } from "@/lib/server/auth";

export const dynamic = "force-dynamic";

export default async function UsersPermissionPage() {
  const user = await requireAdmin("/permissions/users");
  const initialData = await listUsersPage({ page: 1, pageSize: 10 });

  return (
    <UsersPermissionView currentUser={user} initialData={initialData} />
  );
}
