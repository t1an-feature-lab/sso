import { NextResponse } from "next/server";
import { getCurrentUser } from "@/server/auth";
import { db } from "@/server/db";
import { decryptClientSecret } from "@/server/secret-cipher";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const uuid = /^[a-f\d]{8}-(?:[a-f\d]{4}-){3}[a-f\d]{12}$/i;
const headers = {
  "Cache-Control": "private, no-store",
  "X-Content-Type-Options": "nosniff",
};

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string; secretId: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "请先登录" }, { status: 401, headers });
  const { id, secretId } = await context.params;
  if (!uuid.test(id) || !uuid.test(secretId)) {
    return NextResponse.json({ error: "密钥不存在" }, { status: 404, headers });
  }
  const row = await db.clientSecret.findFirst({
    where: {
      id: secretId, applicationId: id,
      ...(user.role === "admin" ? {} : { application: { ownerId: user.id } }),
    },
    select: { secretEncrypted: true },
  });
  if (!row) {
    return NextResponse.json({ error: "密钥不存在或无权查看" }, { status: 404, headers });
  }
  const clientSecret = decryptClientSecret(row.secretEncrypted);
  if (!clientSecret) {
    return NextResponse.json({ error: "密钥读取失败，请生成新密钥" }, { status: 500, headers });
  }
  return NextResponse.json({ clientSecret }, { headers });
}
