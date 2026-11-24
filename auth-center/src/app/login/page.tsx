import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Card } from "@astryxdesign/core/Card";
import { Center } from "@astryxdesign/core/Center";
import { LoginForm } from "@/components/login-form";
import { getCurrentUser } from "@/server/auth";
import "./login.css";

export const metadata: Metadata = {
  title: "登录 · Auth Center",
};

function BrandIcon() {
  return (
    <span className="login-brand-icon" aria-hidden="true">
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none">
        <path
          d="M12 2 3.75 5v6c0 5.05 3.52 9.45 8.25 10.5 4.73-1.05 8.25-5.45 8.25-10.5V5L12 2Z"
          fill="var(--color-accent)"
        />
        <circle cx="12" cy="9.6" r="2.25" fill="var(--color-on-accent)" />
        <path
          d="M10.85 11.2h2.3l.4 4.1h-3.1l.4-4.1Z"
          fill="var(--color-on-accent)"
        />
      </svg>
    </span>
  );
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string | string[] }> }) {
  const params = await searchParams;
  const requested = typeof params.next === "string" ? params.next : "";
  const next = requested.startsWith("/") && !requested.startsWith("//") && !requested.includes("\\") && !requested.startsWith("/login") ? requested : "";
  const user = await getCurrentUser();
  if (user) redirect(next && !(next.startsWith("/admin") && user.role !== "admin") ? next : "/");

  const destination = next.startsWith("/admin") ? "Auth Center 管理后台" : "Auth Center";

  return (
    <main>
      <Center axis="both" padding={4} minHeight="100dvh" className="login-page">
        <Card width="100%" maxWidth={960} padding={0} className="login-card">
          <div className="login-card-header">
            <BrandIcon />
            <span className="login-header-title">使用 Auth Center 登录</span>
          </div>
          <div className="login-card-body">
            <div className="login-intro">
              <h1 className="login-title">登录</h1>
              <p className="login-subtitle">
                继续前往 <span className="login-destination">{destination}</span>
              </p>
            </div>
            <LoginForm next={next} />
          </div>
        </Card>
      </Center>
    </main>
  );
}
