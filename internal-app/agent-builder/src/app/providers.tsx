"use client";

import { LinkProvider } from "@astryxdesign/core/Link";
import { LayerProvider } from "@astryxdesign/core/Layer";
import { CheckIndicator } from "@astryxdesign/core/Indicator";
import { InternationalizationProvider } from "@astryxdesign/core/i18n";
import zhCN from "@astryxdesign/core/locales/zh-CN.json";
import { Theme, type ThemeMode } from "@astryxdesign/core/theme";
import { themes, defaultThemeSlug } from "@/astryx-themes";
import Link from "next/link";
import { createContext, useContext, useState, type ReactNode } from "react";

const ColorModeContext = createContext<{
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
} | null>(null);

const defaultTheme = themes[defaultThemeSlug];
const appTheme = {
  ...defaultTheme,
  indicators: { ...defaultTheme.indicators, radio: CheckIndicator },
};

export function useColorMode() {
  const context = useContext(ColorModeContext);
  if (!context) throw new Error("useColorMode requires Providers");
  return context;
}

export function Providers({
  children,
  initialMode = "system",
}: {
  children: ReactNode;
  initialMode?: ThemeMode;
}) {
  const [mode, setMode] = useState(initialMode);

  function changeMode(nextMode: ThemeMode) {
    setMode(nextMode);
    document.cookie = `agent-builder-theme=${nextMode}; Path=/; Max-Age=31536000; SameSite=Lax${
      location.protocol === "https:" ? "; Secure" : ""
    }`;
  }

  return (
    <ColorModeContext value={{ mode, setMode: changeMode }}>
      <Theme theme={appTheme} mode={mode}>
        <InternationalizationProvider
          locale="zh-CN"
          messages={{ "zh-CN": zhCN }}
        >
          <LinkProvider component={Link}>
            <LayerProvider toast={{ position: "topEnd", maxVisible: 3 }}>
              {children}
            </LayerProvider>
          </LinkProvider>
        </InternationalizationProvider>
      </Theme>
    </ColorModeContext>
  );
}
