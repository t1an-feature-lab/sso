import { redirect } from "next/navigation";
import { requireUser } from "@/server/auth";

export default async function SettingsIndexPage() {
  await requireUser("/settings/profile");
  redirect("/settings/profile");
}
