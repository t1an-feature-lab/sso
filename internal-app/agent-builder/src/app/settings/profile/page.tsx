import { requireUser } from "@/server/auth";
import { getUserProfileStats } from "@/server/profile";
import { ProfileSettingsView } from "@/components/profile-settings-view";

export default async function SettingsProfilePage() {
  const user = await requireUser("/settings/profile");
  const stats = await getUserProfileStats(user.id);

  return (
    <ProfileSettingsView
      initialUser={user}
      projectCount={stats.projectCount}
      sessionCount={stats.sessionCount}
    />
  );
}
