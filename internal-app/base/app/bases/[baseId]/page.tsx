import { notFound, redirect } from "next/navigation";
import { EmptyBaseView } from "@/components/bases/empty-base-view";
import { getBaseDetail, HttpError } from "@/lib/server/repository";

export const dynamic = "force-dynamic";

export default async function BasePage({
  params,
}: {
  params: Promise<{ baseId: string }>;
}) {
  const { baseId } = await params;

  let detail;
  try {
    detail = await getBaseDetail(baseId);
  } catch (error) {
    if (error instanceof HttpError && error.status === 404) {
      notFound();
    }
    throw error;
  }

  if (detail.tables.length > 0) {
    redirect(`/bases/${baseId}/tables/${detail.tables[0].id}`);
  }

  return <EmptyBaseView detail={detail} />;
}
