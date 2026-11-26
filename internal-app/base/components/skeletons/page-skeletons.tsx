import { Skeleton } from "@/components/ui/skeleton";

export function BaseRowsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, idx) => (
        <tr
          key={`base-skeleton-${idx}`}
          className="h-11 border-b border-border last:border-b-0"
        >
          <td className="py-0 pl-3 pr-1">
            <div className="flex items-center gap-1.5">
              <Skeleton className="size-4 rounded-sm" />
              <Skeleton className="size-5 rounded-md" />
            </div>
          </td>
          <td className="px-3 py-0">
            <Skeleton className="h-4 w-36" />
          </td>
          <td className="px-3 py-0">
            <Skeleton className="h-4 w-56" />
          </td>
          <td className="px-3 py-0">
            <Skeleton className="h-4 w-32" />
          </td>
          <td className="px-3 py-0">
            <Skeleton className="h-4 w-32" />
          </td>
          <td className="px-3 py-0 text-right">
            <Skeleton className="ml-auto size-6 rounded-md" />
          </td>
        </tr>
      ))}
    </>
  );
}

export function BasesHomeSkeleton() {
  return (
    <div
      aria-busy="true"
      aria-label="正在加载数据库列表"
      className="flex h-dvh w-full overflow-hidden bg-background"
    >
      <aside className="flex w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar">
        <div className="flex h-12 items-center gap-2.5 px-3">
          <Skeleton className="size-7 rounded-md" />
          <Skeleton className="h-4 w-24" />
        </div>
        <div className="flex flex-1 flex-col gap-2 px-3 pt-2 pb-3">
          <Skeleton className="h-9 w-full rounded-md" />
        </div>
        <div className="px-3 pt-2 pb-3">
          <div className="flex items-center gap-2.5 px-1">
            <Skeleton className="size-6 rounded-full" />
            <Skeleton className="h-4 w-20" />
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex h-12 shrink-0 items-center border-b border-border px-4">
          <Skeleton className="-ml-1.5 size-8 rounded-md" />
          <Skeleton className="ml-0.5 h-4 w-px" />
          <Skeleton className="ml-2.5 h-4 w-24" />
        </header>

        <main className="flex-1 overflow-y-auto p-4">
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2.5">
              <Skeleton className="h-8 w-28 rounded-md" />
              <Skeleton className="h-8 w-72 rounded-md" />
            </div>

            <div className="overflow-hidden rounded-md border border-border bg-table-body">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="h-11 border-b border-border bg-table-header">
                    <th className="w-16 pl-3 pr-1" />
                    <th className="min-w-48 px-3 text-left">
                      <Skeleton className="h-4 w-20" />
                    </th>
                    <th className="min-w-60 px-3 text-left">
                      <Skeleton className="h-4 w-12" />
                    </th>
                    <th className="w-48 px-3 text-left">
                      <Skeleton className="h-4 w-16" />
                    </th>
                    <th className="w-48 px-3 text-left">
                      <Skeleton className="h-4 w-16" />
                    </th>
                    <th className="w-12 px-3" />
                  </tr>
                </thead>
                <tbody>
                  <BaseRowsSkeleton count={6} />
                </tbody>
              </table>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

export function TableWorkspaceSkeleton() {
  return (
    <div
      aria-busy="true"
      aria-label="正在加载数据表"
      className="flex h-dvh w-full overflow-hidden bg-background"
    >
      <aside className="flex w-60 shrink-0 flex-col border-r border-border bg-background">
        <div className="flex h-12 items-center justify-between px-2">
          <Skeleton className="h-5 w-32" />
          <div className="flex items-center gap-1">
            <Skeleton className="size-7 rounded-md" />
            <Skeleton className="size-7 rounded-md" />
          </div>
        </div>
        <div className="flex flex-1 flex-col gap-2 px-3 pt-2 pb-3">
          <Skeleton className="h-4 w-14" />
          <Skeleton className="h-9 w-full rounded-md" />
          <Skeleton className="h-9 w-full rounded-md" />
          <Skeleton className="h-9 w-full rounded-md" />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex h-12 shrink-0 items-center gap-2 border-b border-border px-4">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="size-7 rounded-md" />
          <Skeleton className="h-8 w-24 rounded-md" />
          <Skeleton className="h-8 w-20 rounded-md" />
          <Skeleton className="size-8 rounded-md" />
        </header>

        <div className="flex h-12 shrink-0 items-center justify-between border-b border-border px-4">
          <div className="flex items-center gap-2">
            <Skeleton className="h-8 w-24 rounded-md" />
            <Skeleton className="h-8 w-20 rounded-md" />
            <Skeleton className="h-8 w-16 rounded-md" />
            <Skeleton className="h-8 w-16 rounded-md" />
          </div>
          <Skeleton className="size-8 rounded-md" />
        </div>

        <div className="flex flex-1 flex-col overflow-hidden">
          <div className="flex h-10 items-center border-b border-border px-3 gap-4">
            <Skeleton className="size-4 rounded-sm" />
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-32" />
          </div>
          <div className="flex flex-1 flex-col">
            {Array.from({ length: 10 }).map((_, idx) => (
              <div
                key={`grid-sk-${idx}`}
                className="flex h-11 items-center gap-4 border-b border-border px-3"
              >
                <Skeleton className="h-4 w-6" />
                <Skeleton className="h-4 w-44" />
                <Skeleton className="h-5 w-20 rounded-md" />
                <Skeleton className="h-5 w-24 rounded-md" />
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-28" />
              </div>
            ))}
          </div>
        </div>

        <footer className="flex h-10 shrink-0 items-center justify-between border-t border-border px-4">
          <Skeleton className="h-5 w-20 rounded-md" />
          <Skeleton className="h-4 w-16" />
        </footer>
      </div>
    </div>
  );
}
