import { notFound } from "next/navigation";
import { TableDetailBridge } from "@/components/bitable/base-workspace-shell";
import { getTableDetail, HttpError } from "@/lib/server/repository";

export const dynamic = "force-dynamic";

export default async function TableDetailPage({
  params,
}: {
  params: Promise<{ baseId: string; tableId: string }>;
}) {
  const { baseId, tableId } = await params;

  let detail;
  try {
    detail = await getTableDetail(tableId);
  } catch (error) {
    if (error instanceof HttpError && error.status === 404) {
      notFound();
    }
    throw error;
  }

  if (detail.base.id !== baseId) {
    notFound();
  }

  return <TableDetailBridge data={detail} />;
}
