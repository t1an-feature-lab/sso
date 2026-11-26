import { Skeleton } from "@/components/ui/skeleton";

export default function WorkspaceLoading() {
  return (
    <div
      aria-busy="true"
      aria-label="正在加载页面"
      className="flex flex-col gap-4"
    >
      <div className="overflow-hidden rounded-md border border-border bg-table-body">
        <div className="flex h-11 items-center gap-6 border-b border-border bg-table-header px-4">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-28" />
        </div>
        <div className="divide-y divide-border">
          {Array.from({ length: 5 }).map((_, idx) => (
            <div key={idx} className="flex h-12 items-center gap-6 px-4">
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-36" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
