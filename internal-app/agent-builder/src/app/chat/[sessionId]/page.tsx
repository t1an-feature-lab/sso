import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import {
  CHAT_PANEL_WIDTH_COOKIE,
  parseChatPanelWidth,
} from "@/lib/chat-panel-prefs";
import {
  WORKSPACE_TABS_COOKIE,
  parseWorkspaceTabsCookie,
} from "@/lib/workspace-tabs-prefs";
import { requireUser } from "@/server/auth";
import { listAvailableModels } from "@/server/models";
import { getChatSession, listProjects } from "@/server/sessions";
import { ChatSessionView } from "@/components/chat-session-view";

export default async function ChatSessionPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const user = await requireUser();
  const { sessionId } = await params;
  const [session, projects, models, cookieStore] = await Promise.all([
    getChatSession(user.id, sessionId),
    listProjects(user.id),
    listAvailableModels(),
    cookies(),
  ]);

  if (!session) {
    notFound();
  }

  const initialChatWidth = parseChatPanelWidth(
    cookieStore.get(CHAT_PANEL_WIDTH_COOKIE)?.value
  );
  const initialWorkspaceTabs = parseWorkspaceTabsCookie(
    cookieStore.get(WORKSPACE_TABS_COOKIE)?.value
  );

  return (
    <ChatSessionView
      key={session.id}
      initialSession={session}
      initialProjects={projects}
      initialModels={models}
      initialChatWidth={initialChatWidth}
      initialWorkspaceTabs={initialWorkspaceTabs}
    />
  );
}
