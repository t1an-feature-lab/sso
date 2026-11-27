import { requireAdmin } from "@/server/auth";
import { listModelConfigs } from "@/server/models";
import { ModelConfigView } from "@/components/model-config-view";

export default async function SettingsModelsPage() {
  await requireAdmin("/settings/models", "/settings/profile");
  const initialModels = await listModelConfigs();

  return <ModelConfigView initialModels={initialModels} />;
}
