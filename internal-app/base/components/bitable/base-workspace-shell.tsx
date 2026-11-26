"use client";

import { useParams } from "next/navigation";
import {
  createContext,
  useContext,
  useLayoutEffect,
  useMemo,
  useState,
} from "react";
import { TableWorkspaceSkeleton } from "@/components/skeletons/page-skeletons";
import type { TableDetailPayload } from "@/lib/bitable/types";
import { TableWorkspace } from "./table-workspace";

type TableWorkspaceContextValue = {
  detail: TableDetailPayload | null;
  setDetail: (detail: TableDetailPayload) => void;
};

const TableWorkspaceContext = createContext<TableWorkspaceContextValue | null>(
  null
);

export function BaseWorkspaceShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const params = useParams<{ tableId?: string }>();
  const hasTable = typeof params.tableId === "string";
  const [detail, setDetail] = useState<TableDetailPayload | null>(null);
  const value = useMemo(() => ({ detail, setDetail }), [detail]);

  return (
    <TableWorkspaceContext.Provider value={value}>
      {hasTable ? <PersistentTableWorkspace /> : null}
      {children}
    </TableWorkspaceContext.Provider>
  );
}

function PersistentTableWorkspace() {
  const { detail } = useTableWorkspace();
  if (!detail) return <TableWorkspaceSkeleton />;
  return <TableWorkspace initialData={detail} />;
}

export function TableDetailBridge({ data }: { data: TableDetailPayload }) {
  const { setDetail } = useTableWorkspace();

  useLayoutEffect(() => {
    setDetail(data);
  }, [data, setDetail]);

  return null;
}

function useTableWorkspace() {
  const value = useContext(TableWorkspaceContext);
  if (!value) {
    throw new Error("表格工作区必须放在数据库布局中");
  }
  return value;
}
