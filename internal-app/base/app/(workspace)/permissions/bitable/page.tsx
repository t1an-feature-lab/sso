import { BitablePermissionView } from "@/components/permissions/bitable-permission-view";
import type { PermissionPrincipal } from "@/lib/permissions/bitable-scopes";
import { requireAdmin } from "@/lib/server/auth";

export const dynamic = "force-dynamic";

export default async function BitablePermissionPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  await requireAdmin("/permissions/bitable");
  const params = await searchParams;
  const initialTab: PermissionPrincipal =
    params.tab === "app" ? "app" : "user";

  return <BitablePermissionView initialTab={initialTab} />;
}
