import { NextResponse } from "next/server";
import { requireApiUser } from "@/server/auth";
import { db } from "@/server/db";
import { handleApiError, HttpError } from "@/server/http";
import { imagePartsFromJson, readChatImage } from "@/server/message-images";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ sessionId: string; messageId: string; imageId: string }> }
) {
  try {
    const user = await requireApiUser();
    const { sessionId, messageId, imageId } = await context.params;
    const message = await db.chatMessage.findFirst({
      where: {
        id: messageId,
        sessionId,
        session: { userId: user.id },
      },
      select: { parts: true },
    });
    if (!message) {
      throw new HttpError(404, "图片不存在");
    }
    const image = imagePartsFromJson(message.parts).find((item) => item.id === imageId);
    if (!image) {
      throw new HttpError(404, "图片不存在");
    }
    const bytes = await readChatImage(messageId, image.id);
    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        "Content-Type": image.mediaType,
        "Cache-Control": "private, max-age=86400",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
