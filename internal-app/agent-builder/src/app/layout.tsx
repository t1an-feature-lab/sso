import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { CHAT_SCROLL_CONTAINER_ID } from "@/lib/chat-panel-prefs";
import { APP_OVERLAY_SCROLLBAR_SCRIPT } from "@/lib/overlay-scrollbar";
import "./globals.css";
import { Providers } from "./providers";

const CHAT_SCROLL_INIT_SCRIPT = `(function(){var el=document.getElementById(${JSON.stringify(
  CHAT_SCROLL_CONTAINER_ID
)});if(!el)return;var pin=function(){if(el.scrollHeight>el.clientHeight){el.scrollTop=el.scrollHeight-el.clientHeight;}};pin();if(document.fonts&&document.fonts.ready){document.fonts.ready.then(pin);}})();`;

export const metadata: Metadata = {
  title: "Agent Builder",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  const preference = (await cookies()).get("agent-builder-theme")?.value;
  const mode =
    preference === "light" || preference === "dark" ? preference : "system";

  return (
    <html
      lang="zh-CN"
      data-theme={mode === "system" ? undefined : mode}
      style={{ height: "100%", overflow: "hidden" }}
    >
      <head>
        <meta
          name="color-scheme"
          content={mode === "system" ? "light dark" : mode}
        />
      </head>
      <body style={{ height: "100%", margin: 0, overflow: "hidden" }}>
        <Providers initialMode={mode}>{children}</Providers>
        <script
          dangerouslySetInnerHTML={{ __html: CHAT_SCROLL_INIT_SCRIPT }}
        />
        <script
          dangerouslySetInnerHTML={{ __html: APP_OVERLAY_SCROLLBAR_SCRIPT }}
        />
      </body>
    </html>
  );
}
