"use client";

import { PlusIcon, Table2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { bitableApi } from "@/lib/bitable/api-client";
import type { BaseDetailPayload } from "@/lib/bitable/types";

export function EmptyBaseView({ detail }: { detail: BaseDetailPayload }) {
  const router = useRouter();
  const [name, setName] = useState("数据表 1");
  const [submitting, setSubmitting] = useState(false);

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error("请输入数据表名称");
      return;
    }
    setSubmitting(true);
    try {
      const { table } = await bitableApi.createTable(detail.base.id, {
        name: trimmed,
      });
      toast.success("数据表已创建");
      router.push(`/bases/${detail.base.id}/tables/${table.id}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "创建失败");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex h-dvh w-full overflow-hidden bg-background">
      <AppSidebar
        bases={detail.bases}
        activeBase={detail.base}
        tables={detail.tables}
      />
      <main className="flex flex-1 flex-col items-center justify-center p-6">
        <Card className="w-full max-w-md px-6">
          <div className="flex flex-col items-center gap-2 text-center">
            <div className="flex size-11 items-center justify-center rounded-lg bg-muted text-foreground">
              <Table2Icon className="size-5" aria-hidden="true" />
            </div>
            <h1 className="font-heading text-base font-medium">{detail.base.name}</h1>
            <p className="text-xs text-muted-foreground">
              当前数据库暂无数据表，请创建第一张表开始录入数据
            </p>
          </div>

          <form onSubmit={handleCreate} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="empty-table-name">数据表名称</Label>
              <Input
                id="empty-table-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="例如：订单表"
                required
              />
            </div>
            <Button type="submit" disabled={submitting}>
              <PlusIcon className="size-4" aria-hidden="true" />
              {submitting ? "创建中..." : "新建数据表"}
            </Button>
          </form>
        </Card>
      </main>
    </div>
  );
}
