import { NextResponse } from "next/server";
import { requireApiUser } from "@/server/auth";
import { db } from "@/server/db";
import { handleApiError, HttpError } from "@/server/http";
import {
  assertTerminalSession,
  attachTerminalSession,
  closeTerminalSession,
  resizeTerminalSession,
  writeTerminalSession,
} from "@/server/terminal-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 800;

const SESSION_RE = /^[a-f0-9]{32}$/;

async function ownedProject(userId: string, projectId: string) {
  const project = await db.project.findFirst({
    where: { id: projectId, userId },
    select: { id: true },
  });
  if (!project) throw new HttpError(404, "Project 不存在");
}

function assertSessionId(sessionId: string) {
  if (!SESSION_RE.test(sessionId)) throw new HttpError(404, "终端不存在");
}

function copyBytes(chunk: Buffer): Uint8Array {
  const copy = new Uint8Array(chunk.byteLength);
  copy.set(chunk);
  return copy;
}

export async function GET(
  request: Request,
  context: { params: Promise<{ projectId: string; sessionId: string }> }
) {
  try {
    const user = await requireApiUser();
    const { projectId, sessionId } = await context.params;
    await ownedProject(user.id, projectId);
    assertSessionId(sessionId);
    assertTerminalSession(user.id, projectId, sessionId);

    let unsubscribe: () => void = () => undefined;
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        try {
          const attached = attachTerminalSession(
            user.id,
            projectId,
            sessionId,
            (chunk) => {
              if (!chunk) {
                try {
                  controller.close();
                } catch {
                  // The client already disconnected.
                }
                return;
              }
              try {
                controller.enqueue(copyBytes(chunk));
              } catch {
                unsubscribe();
              }
            }
          );
          unsubscribe = attached.unsubscribe;
          if (attached.replay.byteLength > 0) {
            controller.enqueue(copyBytes(attached.replay));
          }
          if (attached.closed) controller.close();
        } catch (error) {
          controller.error(error);
        }
      },
      cancel() {
        unsubscribe();
      },
    });
    request.signal.addEventListener("abort", () => unsubscribe(), { once: true });
    return new Response(stream, {
      headers: {
        "Content-Type": "application/octet-stream",
        "Cache-Control": "no-cache, no-transform",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ projectId: string; sessionId: string }> }
) {
  try {
    const user = await requireApiUser();
    const { projectId, sessionId } = await context.params;
    await ownedProject(user.id, projectId);
    assertSessionId(sessionId);
    const body = (await request.json().catch(() => null)) as {
      data?: unknown;
      cols?: unknown;
      rows?: unknown;
    } | null;
    if (!body) throw new HttpError(400, "缺少终端输入");
    if (typeof body.cols === "number" && typeof body.rows === "number") {
      await resizeTerminalSession({
        userId: user.id,
        projectId,
        sessionId,
        cols: body.cols,
        rows: body.rows,
      });
    }
    if (typeof body.data === "string" && body.data.length > 0) {
      writeTerminalSession({
        userId: user.id,
        projectId,
        sessionId,
        data: body.data,
      });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ projectId: string; sessionId: string }> }
) {
  try {
    const user = await requireApiUser();
    const { projectId, sessionId } = await context.params;
    await ownedProject(user.id, projectId);
    assertSessionId(sessionId);
    closeTerminalSession(user.id, projectId, sessionId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
