"use client";

import { useActionState, useEffect, useId, useRef, useState } from "react";
import { Button } from "@astryxdesign/core/Button";
import { useAppToast } from "@/components/app-toast";
import type { ActionState } from "@/common/types";
import { loginAction } from "@/server/actions";

function ErrorIcon() {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor" aria-hidden="true">
      <path d="M8 1.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13Zm0 3.25a.75.75 0 0 1 .75.75v3a.75.75 0 0 1-1.5 0v-3A.75.75 0 0 1 8 4.75Zm0 6.5a.875.875 0 1 1 0-1.75.875.875 0 0 1 0 1.75Z" />
    </svg>
  );
}

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(loginAction, {});
  const [account, setAccount] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [edited, setEdited] = useState<Set<string>>(new Set());
  const formRef = useRef<HTMLFormElement>(null);
  const accountId = useId();
  const passwordId = useId();
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

  const errorFor = (field: string) => (!edited.has(field) ? state.fieldErrors?.[field] : undefined);
  const accountError = errorFor("account");
  const passwordError = errorFor("password");

  return (
    <form
      ref={formRef}
      action={action}
      noValidate
      className="login-form"
      onSubmit={() => {
        setEdited(new Set());
        sessionStorage.setItem("sso:auth-notice", "login");
      }}
    >
      <input type="hidden" name="next" value={next} />
      <div className="login-fields">
        <div className="google-field" data-invalid={accountError ? "true" : undefined}>
          <div className="google-field-box" data-filled={account.length > 0 ? "true" : undefined}>
            <input
              id={accountId}
              className="google-field-input"
              name="account"
              type="text"
              placeholder=" "
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              autoFocus
              required
              disabled={pending}
              value={account}
              aria-invalid={accountError ? true : undefined}
              aria-describedby={accountError ? `${accountId}-error` : undefined}
              onChange={(event) => {
                setAccount(event.target.value);
                setEdited((fields) => new Set(fields).add("account"));
              }}
            />
            <label htmlFor={accountId} className="google-field-label">手机号 / 管理员账号</label>
          </div>
          {accountError && (
            <div id={`${accountId}-error`} className="google-field-error" role="alert">
              <ErrorIcon />
              <span>{accountError}</span>
            </div>
          )}
        </div>

        <div className="google-field" data-invalid={passwordError ? "true" : undefined}>
          <div className="google-field-box" data-filled={password.length > 0 ? "true" : undefined}>
            <input
              id={passwordId}
              className="google-field-input"
              name="password"
              type={showPassword ? "text" : "password"}
              placeholder=" "
              autoComplete="current-password"
              required
              disabled={pending}
              value={password}
              aria-invalid={passwordError ? true : undefined}
              aria-describedby={passwordError ? `${passwordId}-error` : undefined}
              onChange={(event) => {
                setPassword(event.target.value);
                setEdited((fields) => new Set(fields).add("password"));
              }}
            />
            <label htmlFor={passwordId} className="google-field-label">密码</label>
          </div>
          {passwordError && (
            <div id={`${passwordId}-error`} className="google-field-error" role="alert">
              <ErrorIcon />
              <span>{passwordError}</span>
            </div>
          )}
        </div>
      </div>

      <label className="google-checkbox">
        <input
          type="checkbox"
          checked={showPassword}
          disabled={pending}
          onChange={(event) => setShowPassword(event.target.checked)}
        />
        <span>显示密码</span>
      </label>

      <p className="login-helper">未注册的手机号将自动创建账号</p>

      <div className="login-form-actions">
        <Button
          label={pending ? "正在登录…" : "登录 / 注册"}
          type="submit"
          variant="primary"
          size="lg"
          isLoading={pending}
          className="login-submit-button"
        />
      </div>
    </form>
  );
}
