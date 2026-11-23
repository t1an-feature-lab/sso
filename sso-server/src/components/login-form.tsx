"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Button } from "@astryxdesign/core/Button";
import { FormLayout } from "@astryxdesign/core/FormLayout";
import { TextInput } from "@astryxdesign/core/TextInput";
import { useAppToast } from "@/components/app-toast";
import { VStack } from "@astryxdesign/core/VStack";
import type { ActionState } from "@/common/types";
import { loginAction } from "@/server/actions";

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(loginAction, {});
  const [account, setAccount] = useState("");
  const [password, setPassword] = useState("");
  const [edited, setEdited] = useState<Set<string>>(new Set());
  const formRef = useRef<HTMLFormElement>(null);
  const toast = useAppToast();

  useEffect(() => {
    if (sessionStorage.getItem("sso:auth-notice") === "logout") {
      sessionStorage.removeItem("sso:auth-notice");
      toast({ body: "已退出登录", uniqueID: "auth-notice" });
    }
  }, [toast]);

  useEffect(() => {
    if (state.error) {
      sessionStorage.removeItem("sso:auth-notice");
      toast({ body: state.error, type: "error", uniqueID: "login-error" });
      const field = Object.keys(state.fieldErrors ?? {})[0];
      if (field) formRef.current?.querySelector<HTMLInputElement>(`[name="${field}"]`)?.focus();
    }
  }, [state, toast]);

  const errorFor = (field: string) => !edited.has(field) && state.fieldErrors?.[field] ? { type: "error" as const, message: state.fieldErrors[field] } : undefined;

  return (
    <form ref={formRef} action={action} noValidate onSubmit={() => {
      setEdited(new Set());
      sessionStorage.setItem("sso:auth-notice", "login");
    }}>
      <input type="hidden" name="next" value={next} />
      <VStack gap={4} hAlign="stretch">
        <FormLayout>
          <TextInput
            label="手机号 / 管理员账号"
            isLabelHidden
            isRequired
            placeholder="手机号 / 管理员账号"
            htmlName="account"
            autoComplete="username"
            autoCapitalize="none"
            hasAutoCorrect={false}
            hasSpellCheck={false}
            value={account}
            onChange={(value) => { setAccount(value); setEdited((fields) => new Set(fields).add("account")); }}
            status={errorFor("account")}
            isDisabled={pending}
            size="lg"
          />
          <TextInput
            label="密码"
            isLabelHidden
            isRequired
            placeholder="密码"
            htmlName="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(value) => { setPassword(value); setEdited((fields) => new Set(fields).add("password")); }}
            status={errorFor("password")}
            isDisabled={pending}
            size="lg"
          />
        </FormLayout>
        <Button label={pending ? "正在登录…" : "登录 / 注册"} type="submit" variant="primary" size="lg" width="100%" isLoading={pending} />
      </VStack>
    </form>
  );
}
