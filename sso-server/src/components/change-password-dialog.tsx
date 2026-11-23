"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { Button } from "@astryxdesign/core/Button";
import { Dialog, DialogHeader } from "@astryxdesign/core/Dialog";
import { FormLayout } from "@astryxdesign/core/FormLayout";
import { Layout, LayoutContent, LayoutFooter } from "@astryxdesign/core/Layout";
import { HStack } from "@astryxdesign/core/Stack";
import { TextInput } from "@astryxdesign/core/TextInput";
import { useAppToast } from "@/components/app-toast";
import { changePasswordAction } from "@/server/actions";

const passwordFields = ["currentPassword", "newPassword", "confirmPassword"] as const;
type PasswordField = typeof passwordFields[number];

export function ChangePasswordDialog({
  isOpen,
  onOpenChange,
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const toast = useAppToast();
  const formId = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const submitting = useRef(false);
  const errorFocus = useRef<PasswordField | undefined>(undefined);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);
  const status = (field: PasswordField) => errors[field] ? { type: "error" as const, message: errors[field] } : undefined;

  useEffect(() => {
    if (errorFocus.current) {
      formRef.current?.querySelector<HTMLInputElement>(`[name="${errorFocus.current}"]`)?.focus();
      errorFocus.current = undefined;
    }
  }, [errors]);

  function changeOpen(open: boolean) {
    if (!submitting.current) onOpenChange(open);
  }

  function update(field: PasswordField, value: string, setter: (value: string) => void) {
    setter(value);
    if (errors[field]) setErrors((previous) => ({ ...previous, [field]: "" }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    submitting.current = true;
    setPending(true);
    const data = new FormData(event.currentTarget);
    try {
      const result = await changePasswordAction(data);
      if (result.error || result.fieldErrors) {
        errorFocus.current = passwordFields.find((field) => result.fieldErrors?.[field]);
        setErrors(result.fieldErrors ?? {});
        toast({ body: result.error ?? "请检查输入内容", type: "error", uniqueID: "change-password" });
        return;
      }
      toast({ body: result.success ?? "密码已更改", uniqueID: "change-password" });
      onOpenChange(false);
    } catch {
      toast({ body: "密码更改失败，请稍后重试", type: "error", uniqueID: "change-password" });
    } finally {
      submitting.current = false;
      setPending(false);
    }
  }

  return (
    <Dialog isOpen={isOpen} onOpenChange={changeOpen} purpose="form" width={480}>
      <Layout
        header={<DialogHeader title="更改密码" onOpenChange={pending ? undefined : changeOpen} />}
        content={<LayoutContent>
          <form ref={formRef} id={formId} onSubmit={submit} noValidate aria-label="更改密码" aria-busy={pending}>
            <FormLayout>
              <TextInput
                label="当前密码"
                htmlName="currentPassword"
                type="password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(value) => update("currentPassword", value, setCurrentPassword)}
                {...{ maxLength: 128 }}
                status={status("currentPassword")}
                statusVariant="detached"
                isRequired
                isDisabled={pending}
                hasAutoFocus
                width="100%"
              />
              <TextInput
                label="新密码"
                htmlName="newPassword"
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(value) => update("newPassword", value, setNewPassword)}
                description="6–128 位字符"
                {...{ minLength: 6, maxLength: 128 }}
                status={status("newPassword")}
                statusVariant="detached"
                isRequired
                isDisabled={pending}
                width="100%"
              />
              <TextInput
                label="确认新密码"
                htmlName="confirmPassword"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(value) => update("confirmPassword", value, setConfirmPassword)}
                {...{ minLength: 6, maxLength: 128 }}
                status={status("confirmPassword")}
                statusVariant="detached"
                isRequired
                isDisabled={pending}
                width="100%"
              />
            </FormLayout>
          </form>
        </LayoutContent>}
        footer={<LayoutFooter hasDivider>
          <HStack gap={2} hAlign="end">
            <Button label="取消" onClick={() => changeOpen(false)} isDisabled={pending} />
            <Button label="更改密码" type="submit" form={formId} variant="primary" isLoading={pending} />
          </HStack>
        </LayoutFooter>}
      />
    </Dialog>
  );
}
