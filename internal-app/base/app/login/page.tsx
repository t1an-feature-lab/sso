import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth/login-form";
import { getCurrentUser } from "@/lib/server/auth";

export const dynamic = "force-dynamic";

function resolveNextPath(raw: string | string[] | undefined): string {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/";
  }
  return value;
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const params = await searchParams;
  const nextPath = resolveNextPath(params.next);
  const user = await getCurrentUser();
  if (user) {
    redirect(nextPath);
  }
  return <LoginForm nextPath={nextPath} />;
}
