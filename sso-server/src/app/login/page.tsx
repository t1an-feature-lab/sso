import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Card } from "@astryxdesign/core/Card";
import { Center } from "@astryxdesign/core/Center";
import { Heading } from "@astryxdesign/core/Heading";
import { VStack } from "@astryxdesign/core/VStack";
import { LoginForm } from "@/components/login-form";
import { getCurrentUser } from "@/server/auth";

export const metadata: Metadata = {
  title: "登录 · Auth Center",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string | string[] }> }) {
  const params = await searchParams;
  const requested = typeof params.next === "string" ? params.next : "";
  const next = requested.startsWith("/") && !requested.startsWith("//") && !requested.includes("\\") && !requested.startsWith("/login") ? requested : "";
  const user = await getCurrentUser();
  if (user) redirect(next ? (next.startsWith("/admin") && user.role !== "admin" ? "/" : next) : user.role === "admin" ? "/admin" : "/");

  return (
    <main>
      <Center axis="both" padding={4} minHeight="100dvh" style={{ backgroundColor: "var(--color-background-body)" }}>
        <Card width="100%" maxWidth={400}>
          <VStack gap={6} hAlign="stretch">
            <Heading level={2} accessibilityLevel={1} justify="center">登录</Heading>
            <LoginForm next={next} />
          </VStack>
        </Card>
      </Center>
    </main>
  );
}
