import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth";
import { LoginSplitView } from "@/components/login-split-view";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const user = await getCurrentUser();
  if (user) {
    redirect("/");
  }
  const { next } = await searchParams;
  return <LoginSplitView nextPath={next} />;
}
