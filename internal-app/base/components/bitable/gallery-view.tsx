"use client";

import { PlusIcon } from "lucide-react";
import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCellText } from "@/lib/bitable/field-registry";
import type {
  FieldSchema,
  RecordData,
  RelationTargetItem,
} from "@/lib/bitable/types";
import { RecordFieldList } from "./record-fields";

interface GalleryViewProps {
  fields: FieldSchema[];
  records: RecordData[];
  hasMore: boolean;
  loadingMore: boolean;
  hiddenFieldIds: string[];
  relationTargets: Record<string, RelationTargetItem[]>;
  onLoadMore: () => void;
  onOpenRecord: (record: RecordData) => void;
  onAddRecord: () => void;
}

export function GalleryView({
  fields,
  records,
  hasMore,
  loadingMore,
  hiddenFieldIds,
  relationTargets,
  onLoadMore,
  onOpenRecord,
  onAddRecord,
}: GalleryViewProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const primaryField = fields.find((field) => field.isPrimary) ?? fields[0];
  const visibleFields = fields.filter(
    (field) => field.id !== primaryField?.id && !hiddenFieldIds.includes(field.id)
  );

  useEffect(() => {
    const sentinel = sentinelRef.current;
    const root = scrollRef.current;
    if (!sentinel || !hasMore || loadingMore) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          onLoadMore();
        }
      },
      { root, rootMargin: "160px" }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, loadingMore, onLoadMore, records.length]);

  return (
    <div ref={scrollRef} className="flex-1 overflow-y-auto bg-muted/40 p-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {records.map((record) => {
          const title =
            (primaryField &&
              formatCellText(
                primaryField,
                record.values[primaryField.id],
                relationTargets
              )) ||
            "未命名记录";
          const previewFields = visibleFields.slice(0, 6);

          return (
            <button
              key={record.id}
              type="button"
              onClick={() => onOpenRecord(record)}
              className="block h-full w-full cursor-pointer rounded-xl border-0 bg-transparent p-0 text-left font-sans outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <Card
                size="sm"
                className="h-full transition-colors hover:bg-muted/50"
              >
                <CardHeader className="min-w-0">
                  <CardTitle className="truncate">{title}</CardTitle>
                </CardHeader>
                {previewFields.length > 0 && (
                  <CardContent>
                    <RecordFieldList
                      fields={previewFields}
                      record={record}
                      relationTargets={relationTargets}
                    />
                  </CardContent>
                )}
              </Card>
            </button>
          );
        })}

        {loadingMore &&
          Array.from({ length: 4 }).map((_, index) => (
            <Card key={`gallery-skeleton-${index}`} size="sm" className="min-h-40">
              <CardHeader>
                <Skeleton className="h-4 w-3/5" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-4/5" />
                <Skeleton className="h-4 w-2/3" />
              </CardContent>
            </Card>
          ))}

        <Button
          type="button"
          variant="outline"
          onClick={onAddRecord}
          className="h-full min-h-40 flex-col gap-2 border-dashed"
        >
          <PlusIcon aria-hidden="true" />
          新增记录
        </Button>
      </div>

      {hasMore && <div ref={sentinelRef} className="h-6 w-full" />}
    </div>
  );
}
