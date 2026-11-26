import { BitablePermissionView } from "@/components/permissions/bitable-permission-view";
import { requireAdmin } from "@/lib/server/auth";

export const dynamic = "force-dynamic";

export default async function BitablePermissionPage() {
  await requireAdmin("/permissions/bitable");
  return <BitablePermissionView />;
}
