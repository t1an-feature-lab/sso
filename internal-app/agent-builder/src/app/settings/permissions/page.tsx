import { listUsersPage, requireAdmin } from "@/server/auth";
import { UsersPermissionTable } from "@/components/users-permission-table";

export default async function SettingsPermissionsPage() {
  const admin = await requireAdmin("/settings/permissions", "/settings/profile");
  const initialData = await listUsersPage({ page: 1, pageSize: 10 });

  return (
    <UsersPermissionTable currentUser={admin} initialData={initialData} />
  );
}
