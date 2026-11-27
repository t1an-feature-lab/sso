import { requireApiUser } from "@/server/auth";
import { runSessionAgent } from "@/server/agent-run";
import { HttpError } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 800;

export async function POST(
  request: Request,
  context: { params: Promise<{ sessionId: string }> }
) {
  const encoder = new TextEncoder();
  let userId = "";
  let sessionId = "";
  let content = "";
  let modelId: string | null = null;
  let continueExisting = false;

  try {
    const user = await requireApiUser();
    userId = user.id;
    sessionId = (await context.params).sessionId;
    const body = (await request.json().catch(() => null)) as {
      content?: unknown;
      modelId?: unknown;
      continue?: unknown;
    } | null;
    content = typeof body?.content === "string" ? body.content : "";
    modelId = typeof body?.modelId === "string" ? body.modelId : null;
    continueExisting = body?.continue === true;
  } catch (error) {
    const message = error instanceof HttpError ? error.message : "请先登录";
    const status = error instanceof HttpError ? error.status : 401;
    return Response.json({ error: message }, { status });
  }

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        if (request.signal.aborted) return;
        try {
          controller.enqueue(
            encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
          );
        } catch {
          // The client already disconnected.
        }
      };
      try {
        const session = await runSessionAgent({
          userId,
          sessionId,
          modelId,
          content,
          continueExisting,
          signal: request.signal,
          onEvent: send,
        });
        send("done", { session });
      } catch (error) {
        const message =
          error instanceof HttpError ? error.message : "生成失败";
        send("error", { message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
