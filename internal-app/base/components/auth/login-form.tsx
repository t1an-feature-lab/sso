"use client";

import { DatabaseIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authApi } from "@/lib/auth/api-client";

export function LoginForm({ nextPath }: { nextPath: string }) {
  const router = useRouter();
  const formId = useId();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (submitting) return;

    const trimmedUsername = username.trim();
    if (!trimmedUsername) {
      toast.error("请输入用户名");
      return;
    }
    if (!password) {
      toast.error("请输入密码");
      return;
    }

    setSubmitting(true);
    try {
      const result = await authApi.login({
        username: trimmedUsername,
        password,
      });
      toast.success(result.registered ? "注册并登录成功" : "登录成功");
      router.replace(nextPath);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "登录失败");
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-dvh w-full items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="gap-2 text-center">
          <div className="mx-auto flex size-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <DatabaseIcon className="size-5" aria-hidden="true" />
          </div>
          <CardTitle className="text-lg">Base Studio</CardTitle>
          <CardDescription>
            已有用户名直接登录，未注册用户名将自动注册
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            id={formId}
            onSubmit={handleSubmit}
            className="flex flex-col gap-4"
          >
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`${formId}-username`}>用户名</Label>
              <Input
                id={`${formId}-username`}
                name="username"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={submitting}
                placeholder="请输入用户名"
                autoFocus
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`${formId}-password`}>密码</Label>
              <Input
                id={`${formId}-password`}
                name="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={submitting}
                placeholder="请输入密码"
              />
            </div>
            <Button type="submit" className="mt-1 w-full" disabled={submitting}>
              {submitting ? "登录中…" : "登录 / 注册"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
