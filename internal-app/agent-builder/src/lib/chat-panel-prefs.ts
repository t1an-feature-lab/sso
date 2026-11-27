export const CHAT_PANEL_WIDTH_COOKIE = "agent_builder_chat_width";
export const CHAT_SCROLL_CONTAINER_ID = "chat-session-scroll-container";
export const CHAT_PANEL_DEFAULT_WIDTH = 540;
export const CHAT_PANEL_MIN_WIDTH = 320;
export const CHAT_PANEL_MAX_WIDTH = 900;

export function parseChatPanelWidth(
  raw: string | undefined | null
): number | null {
  if (!raw) return null;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return null;
  return Math.round(
    Math.min(CHAT_PANEL_MAX_WIDTH, Math.max(CHAT_PANEL_MIN_WIDTH, parsed))
  );
}

export function readChatPanelWidthFromDocument(): number | null {
  if (typeof document === "undefined") return null;
  const prefix = `${CHAT_PANEL_WIDTH_COOKIE}=`;
  const parts = document.cookie.split(";");
  for (const part of parts) {
    const trimmed = part.trim();
    if (trimmed.startsWith(prefix)) {
      return parseChatPanelWidth(
        decodeURIComponent(trimmed.slice(prefix.length))
      );
    }
  }
  return null;
}

export function writeChatPanelWidthCookie(width: number): void {
  if (typeof document === "undefined") return;
  const clamped = parseChatPanelWidth(String(width));
  if (clamped === null) return;
  document.cookie = `${CHAT_PANEL_WIDTH_COOKIE}=${clamped}; path=/; max-age=31536000; SameSite=Lax`;
}
