import "@fontsource-variable/inter";
import "@fontsource-variable/jetbrains-mono";
import type { Metadata } from "next";
import Script from "next/script";
import { Providers } from "@/components/providers";
import { themeBootScript } from "@/lib/theme";
import "./globals.css";

export const metadata: Metadata = {
  title: "多维表格",
  description: "数据库与多维表格工作台",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="zh-CN" className="h-full antialiased" suppressHydrationWarning>
      <body className="min-h-full flex flex-col">
        <Script id="bitable-theme" strategy="beforeInteractive">
          {themeBootScript}
        </Script>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
