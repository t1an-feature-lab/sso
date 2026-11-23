"use client";

import { useState } from "react";
import { HStack } from "@astryxdesign/core/HStack";
import { Pagination, type PaginationProps } from "@astryxdesign/core/Pagination";
import { paginateData } from "@astryxdesign/core/Table";

type TablePagerProps = Pick<PaginationProps,
  "page" | "onChange" | "totalPages" | "pageSize" | "onPageSizeChange" | "label"
>;

export function useTablePage<T>(rows: T[]) {
  const [requestedPage, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const page = Math.min(requestedPage, totalPages);

  if (requestedPage !== page) setPage(page);

  function changePageSize(size: number) {
    setPageSize(size);
    setPage(1);
  }

  return {
    data: paginateData(rows, page, pageSize),
    rowIndexStart: (page - 1) * pageSize + 1,
    resetPage: () => setPage(1),
    controls: {
      page,
      onChange: setPage,
      totalPages,
      pageSize,
      onPageSizeChange: changePageSize,
    },
  };
}

export function TablePager(props: TablePagerProps) {
  return (
    <HStack hAlign="end">
      <Pagination {...props} variant="pages" pageSizeOptions={[10, 20, 50]} />
    </HStack>
  );
}
