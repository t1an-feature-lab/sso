"use client";

import { ShieldCheckIcon } from "lucide-react";

export function BitablePermissionView() {
  return (
    <div className="flex min-h-80 flex-col items-center justify-center rounded-md border border-dashed border-border bg-table-body p-8 text-center">
      <div className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <ShieldCheckIcon className="size-5" aria-hidden="true" />
      </div>
      <p className="mt-3 text-sm font-medium text-foreground">多维表权限</p>
      <p className="mt-1 text-sm text-muted-foreground">
        暂未开放多维表权限配置
      </p>
    </div>
  );
}
