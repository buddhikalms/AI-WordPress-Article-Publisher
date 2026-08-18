import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashToken } from "@/lib/mcp/tokens";
import { readFormOrJson } from "@/lib/mcp/http";

export const runtime = "nodejs";

// RFC 7009 token revocation. Per spec, this endpoint responds 200 even for
// unknown/already-revoked tokens so callers cannot probe token validity.
export async function POST(request: Request) {
  const fields = await readFormOrJson(request);
  const token = fields.get("token") || "";
  const hint = fields.get("token_type_hint") || "";

  if (token) {
    const tokenHash = hashToken(token);
    if (hint !== "refresh_token") {
      await prisma.mcpAccessToken.updateMany({
        where: { tokenHash, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
    if (hint !== "access_token") {
      await prisma.mcpRefreshToken.updateMany({
        where: { tokenHash, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
  }

  return NextResponse.json({}, { status: 200 });
}
