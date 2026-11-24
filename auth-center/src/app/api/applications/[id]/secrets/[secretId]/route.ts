import { NextResponse } from "next/server";
import { QueryTypes } from "sequelize";
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
  const [row] = await db.query<{ secretEncrypted: string | null }>(`
    SELECT s.secret_encrypted AS "secretEncrypted"
    FROM sso_client_secrets s
    JOIN sso_client_applications a ON a.id = s.application_id
    WHERE s.id = :secretId AND a.id = :id ${user.role === "admin" ? "" : "AND a.owner_id = :ownerId"}
  `, { replacements: { id, secretId, ownerId: user.id }, type: QueryTypes.SELECT });
  if (!row) {
    return NextResponse.json({ error: "密钥不存在或无权查看" }, { status: 404, headers });
  }
  if (!row.secretEncrypted) {
    return NextResponse.json({ error: "旧密钥未保存明文，请生成新密钥" }, { status: 409, headers });
  }
  const clientSecret = decryptClientSecret(row.secretEncrypted);
  if (!clientSecret) {
    return NextResponse.json({ error: "密钥读取失败，请生成新密钥" }, { status: 500, headers });
  }
  return NextResponse.json({ clientSecret }, { headers });
}
