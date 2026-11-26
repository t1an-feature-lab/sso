"use client";

import { Trash2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { formatCellText } from "@/lib/bitable/field-registry";
import type {
  FieldSchema,
  RecordData,
  RelationTargetItem,
} from "@/lib/bitable/types";
import { FieldFormControl } from "./cell-editor";

interface RecordDrawerProps {
  record: RecordData | null;
  fields: FieldSchema[];
  relationTargets: Record<string, RelationTargetItem[]>;
  onClose: () => void;
  onUpdateCell: (recordId: string, fieldId: string, value: unknown) => void;
  onDeleteRecord: (recordId: string) => Promise<void>;
}

export function RecordDrawer({
  record,
  fields,
  relationTargets,
  onClose,
  onUpdateCell,
  onDeleteRecord,
}: RecordDrawerProps) {
  const confirm = useConfirm();
  const primaryField = fields.find((f) => f.isPrimary) ?? fields[0];
  const recordTitle =
    (record &&
      primaryField &&
      formatCellText(
        primaryField,
        record.values[primaryField.id],
        relationTargets
      )) ||
    "未命名记录";

  async function handleDelete() {
    if (!record) return;
    const yes = await confirm({
      title: `删除记录「${recordTitle}」？`,
      description: "删除后将同步移除关联关系边且不可恢复",
      confirmLabel: "删除",
      cancelLabel: "取消",
      destructive: true,
    });
    if (!yes) return;
    await onDeleteRecord(record.id);
    onClose();
  }

  return (
    <Sheet
      open={Boolean(record)}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <SheetContent className="gap-0 data-[side=right]:sm:max-w-md">
        <SheetHeader className="pr-10">
          <SheetTitle className="truncate">{recordTitle}</SheetTitle>
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
          {record && (
            <FieldGroup>
              {fields.map((field) => {
                const inputId = `record-field-${field.id}`;
                return (
                  <Field key={field.id}>
                    <FieldLabel htmlFor={inputId}>
                      {field.name}
                      {field.required && (
                        <span className="text-destructive">*</span>
                      )}
                    </FieldLabel>
                    <FieldFormControl
                      id={inputId}
                      field={field}
                      value={record.values[field.id]}
                      relationTargets={relationTargets}
                      onChange={(nextValue) =>
                        onUpdateCell(record.id, field.id, nextValue)
                      }
                    />
                  </Field>
                );
              })}
            </FieldGroup>
          )}
        </div>

        <SheetFooter className="px-4 py-3">
          <Button variant="destructive" onClick={handleDelete}>
            <Trash2Icon aria-hidden="true" />
            删除记录
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
