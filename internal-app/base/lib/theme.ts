export type ThemeMode = "light" | "dark" | "system";

export const THEME_STORAGE_KEY = "bitable-theme";

export const themeBootScript = `(() => {
  try {
    const stored = localStorage.getItem("${THEME_STORAGE_KEY}");
    const mode = stored === "light" || stored === "dark" || stored === "system" ? stored : "system";
    const dark = mode === "dark" || (mode === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.classList.toggle("dark", dark);
    document.documentElement.style.colorScheme = dark ? "dark" : "light";
  } catch {
    /* 读取本地主题失败时保持页面默认外观 */
  }
})();`;
