import { NextResponse } from "next/server";
import { requireApiUser } from "@/server/auth";
import { handleApiError } from "@/server/http";
import { getUserAvatar } from "@/server/profile";

export async function GET(
  _request: Request,
  context: { params: Promise<{ userId: string }> }
) {
  try {
    await requireApiUser();
    const { userId } = await context.params;
    const avatar = await getUserAvatar(userId);
    if (!avatar) {
      return new NextResponse(null, { status: 404 });
    }
    return new NextResponse(Buffer.from(avatar.data), {
      status: 200,
      headers: {
        "Content-Type": avatar.mime,
        "Cache-Control": "private, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
