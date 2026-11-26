import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { cookies } from "next/headers";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "Auth Center Console",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover" };

export default async function RootLayout({ children }: { children: ReactNode }) {
  const preference = (await cookies()).get("sso-theme")?.value;
  const mode = preference === "light" || preference === "dark" ? preference : "system";

  return (
    <html lang="zh-CN" data-theme={mode === "system" ? undefined : mode} style={{ height: "100%", overflow: "hidden" }}>
      <head><meta name="color-scheme" content={mode === "system" ? "light dark" : mode} /></head>
      <body style={{ height: "100%", margin: 0, overflowY: "auto", scrollbarGutter: "stable" }}>
        <Providers initialMode={mode}>{children}</Providers>
      </body>
    </html>
  );
}
