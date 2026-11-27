import { ChatLandingView } from "@/components/chat-landing-view";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ project?: string | string[] }>;
}) {
  const { project } = await searchParams;
  const initialProjectId = typeof project === "string" ? project : undefined;

  return <ChatLandingView initialProjectId={initialProjectId} />;
}
