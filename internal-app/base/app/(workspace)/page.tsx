import { BasesHome } from "@/components/bases/bases-home";
import { requireUser } from "@/lib/server/auth";
import { listBases } from "@/lib/server/repository";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  await requireUser("/");
  const data = await listBases();
  return <BasesHome initialData={data} />;
}
