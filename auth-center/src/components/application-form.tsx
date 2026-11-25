"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { AlertDialog } from "@astryxdesign/core/AlertDialog";
import { Button } from "@astryxdesign/core/Button";
import { CheckboxInput } from "@astryxdesign/core/CheckboxInput";
import { Divider } from "@astryxdesign/core/Divider";
import { FormLayout } from "@astryxdesign/core/FormLayout";
import { Heading } from "@astryxdesign/core/Heading";
import { HStack } from "@astryxdesign/core/HStack";
import { Icon } from "@astryxdesign/core/Icon";
import { edgeCompSlot } from "@astryxdesign/core/Layout";
import { StackItem } from "@astryxdesign/core/Stack";
import { Tab, TabList } from "@astryxdesign/core/TabList";
import { TextInput } from "@astryxdesign/core/TextInput";
import { useAppToast } from "@/components/app-toast";
import { VStack } from "@astryxdesign/core/VStack";
import type { ActionState, ClientApplicationDetail } from "@/common/types";
import { applicationIdenticon } from "@/common/application-identicon";
import { ApplicationCredentials } from "@/components/application-credentials";
import { ApplicationAuthorizations } from "@/components/application-authorizations";
import { ApplicationLogoInput } from "@/components/application-logo-input";
import { useRemoveSearchParam, useUrlTab } from "@/components/use-url-tab";
import {
  createApplicationAction,
  deleteApplicationAction,
  updateApplicationAction,
} from "@/server/application/actions";

export function ApplicationForm({
  application,
  applicationId = application?.id,
  admin = false,
}: {
  application?: ClientApplicationDetail;
  applicationId?: string;
  admin?: boolean;
}) {
  const applicationPath = admin ? "/admin/applications" : "/applications";
  const listHref = admin ? "/admin/applications" : "/";
  useRemoveSearchParam("protocol");
  const title = application?.name ?? "申请应用";
  const router = useRouter();
  const toast = useAppToast();
  const [name, setName] = useState(application?.name ?? "");
  const [homepage, setHomepage] = useState(application?.homepage ?? "");
  const [redirectUris, setRedirectUris] = useState(application?.redirectUris[0] ?? "");
  const [enabled, setEnabled] = useState(application?.status !== "disabled");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [tab, setTab] = useUrlTab("tab", ["configuration", "authorizations"], "configuration");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const panelId = useId();
  const submissionPending = useRef(false);
  const titleId = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const errorFocus = useRef<string | undefined>(undefined);
  const status = (field: string) => errors[field] ? { type: "error" as const, message: errors[field] } : undefined;

  useEffect(() => {
    if (errorFocus.current) {
      const selector = errorFocus.current === "logo"
        ? "[data-logo-field] button"
        : `[name="${errorFocus.current}"]`;
      formRef.current?.querySelector<HTMLElement>(selector)?.focus();
      errorFocus.current = undefined;
    }
  }, [errors]);

  function update(field: string, value: string, setter: (value: string) => void) {
    setter(value);
    if (errors[field]) setErrors((previous) => ({ ...previous, [field]: "" }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || deleting || submissionPending.current) return;
    submissionPending.current = true;
    let navigating = false;
    const form = event.currentTarget;
    const data = new FormData(form);
    if (logoFile) data.set("logo", logoFile);
    setPending(true);
    try {
      const action = application ? updateApplicationAction : createApplicationAction;
      const result: ActionState = await action({}, data);
      if (result.error || result.fieldErrors) {
        errorFocus.current = ["logo", "name", "homepage", "redirectUris"]
          .find((field) => result.fieldErrors?.[field]);
        setErrors(result.fieldErrors ?? {});
        toast({ body: result.error ?? "请检查表单信息", type: "error", uniqueID: "application-save" });
        return;
      }
      toast({ body: result.success ?? (application ? "配置已保存" : "应用已创建"), uniqueID: "application-save" });
      if (application) {
        setLogoFile(null);
        router.refresh();
      } else if (result.id) {
        navigating = true;
        router.replace(`${applicationPath}/${result.id}`);
      }
    } catch {
      toast({ body: "提交失败，请稍后重试", type: "error", uniqueID: "application-save" });
    } finally {
      if (!navigating) {
        submissionPending.current = false;
        setPending(false);
      }
    }
  }

  async function remove() {
    if (!application || pending || deleting) return;
    setDeleting(true);
    const data = new FormData();
    data.set("id", application.id);
    try {
      const result = await deleteApplicationAction({}, data);
      if (result.error) {
        toast({ body: result.error, type: "error", uniqueID: "application-delete" });
        return;
      }
      toast({ body: result.success ?? "应用已删除", uniqueID: "application-delete" });
      setConfirmDelete(false);
      router.replace(listHref);
    } catch {
      toast({ body: "删除失败，请稍后重试", type: "error", uniqueID: "application-delete" });
    } finally {
      setDeleting(false);
    }
  }

  const configuration = (
    <VStack gap={6}>
      {application && <ApplicationCredentials application={application} />}
      <form ref={formRef} onSubmit={submit} noValidate aria-labelledby={titleId} aria-busy={pending || deleting}>
        <input type="hidden" name="status" value={enabled ? "active" : "disabled"} />
        <input type="hidden" name="id" value={applicationId} />
        <VStack gap={6}>
          <VStack gap={4}>
            {application && <Heading level={3} accessibilityLevel={2}>基本配置</Heading>}
            <FormLayout defaultOptionality="required">
              <ApplicationLogoInput
                file={logoFile}
                logoUrl={application?.logoUrl || (applicationId ? applicationIdenticon(applicationId) : "")}
                applicationName={name}
                error={errors.logo}
                isDisabled={pending || deleting}
                onChange={(file) => {
                  setLogoFile(file);
                  if (errors.logo) setErrors((previous) => ({ ...previous, logo: "" }));
                }}
              />
              <TextInput
                label="应用名称"
                htmlName="name"
                value={name}
                onChange={(value) => update("name", value, setName)}
                placeholder="请输入应用名称"
                status={status("name")}
                hasAutoFocus
                isRequired
                isDisabled={pending || deleting}
                width="100%"
              />
              <TextInput
                label="应用主页"
                htmlName="homepage"
                type="url"
                hasSpellCheck={false}
                autoCapitalize="none"
                hasAutoCorrect={false}
                value={homepage}
                onChange={(value) => update("homepage", value, setHomepage)}
                placeholder="https://example.com"
                status={status("homepage")}
                isRequired
                isDisabled={pending || deleting}
                width="100%"
              />
              <TextInput
                label="回调地址"
                htmlName="redirectUris"
                type="url"
                value={redirectUris}
                onChange={(value) => update("redirectUris", value, setRedirectUris)}
                placeholder="https://example.com/callback"
                status={status("redirectUris")}
                isRequired
                isDisabled={pending || deleting}
                hasSpellCheck={false}
                autoCapitalize="none"
                hasAutoCorrect={false}
                width="100%"
              />
              {application && <CheckboxInput label="启用应用" value={enabled} onChange={setEnabled} isDisabled={pending || deleting} />}
            </FormLayout>
          </VStack>
          <HStack>
            <Button label={application ? "保存配置" : "注册应用"} variant="primary" type="submit" isLoading={pending} isDisabled={deleting} />
          </HStack>
        </VStack>
      </form>
    </VStack>
  );

  return (
    <VStack as="section" gap={4}>
      <HStack gap={3} hAlign="between" vAlign="center" wrap="wrap">
        <StackItem size="fill" style={{ flexBasis: "min(100%, 20rem)" }}>
          <HStack gap={3} vAlign="center">
            <StackItem xstyle={edgeCompSlot.inset("var(--spacing-3)")} style={{ marginInlineEnd: 0 }}>
              <Button label="返回" icon={<Icon icon="chevronLeft" />} variant="ghost" href={listHref} isDisabled={pending || deleting} />
            </StackItem>
            <Divider orientation="vertical" aria-hidden style={{ height: "var(--spacing-5)", flexShrink: 0 }} />
            <StackItem size="fill">
              <Heading level={3} accessibilityLevel={1} id={titleId} maxLines={2}>{title}</Heading>
            </StackItem>
          </HStack>
        </StackItem>
      </HStack>
      {application ? (
        <>
          <TabList value={tab} onChange={setTab} aria-label="应用详情" role="tablist" hasDivider isFullBleed>
            <Tab value="configuration" label="应用配置" panelId={`${panelId}-configuration`} />
            <Tab value="authorizations" label="授权用户" panelId={`${panelId}-authorizations`} />
          </TabList>
          <div id={`${panelId}-configuration`} role="tabpanel" aria-label="应用配置" hidden={tab !== "configuration"} tabIndex={0}>
            {configuration}
          </div>
          <div id={`${panelId}-authorizations`} role="tabpanel" aria-label="授权用户" hidden={tab !== "authorizations"} tabIndex={0}>
            <ApplicationAuthorizations application={application} admin={admin} />
          </div>
        </>
      ) : configuration}
      {application && <HStack hAlign="end">
        <Button label="删除应用" variant="destructive" onClick={() => setConfirmDelete(true)} isDisabled={pending || deleting} />
      </HStack>}
      <AlertDialog
        isOpen={confirmDelete}
        onOpenChange={(open) => { if (!deleting) setConfirmDelete(open); }}
        title="删除这个应用？"
        description={`将删除“${application?.name ?? ""}”及其配置`}
        actionLabel="删除应用"
        cancelLabel="取消"
        onAction={remove}
        isActionLoading={deleting}
      />
    </VStack>
  );
}
