import { redirect } from "next/navigation";
import { requireAdmin } from "@/server/auth";

export default async function LegacyPermissionsRedirectPage() {
  await requireAdmin("/settings/permissions");
  redirect("/settings/permissions");
}
