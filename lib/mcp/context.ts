import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import { prisma } from "@/lib/prisma";
import { hashToken } from "@/lib/mcp/tokens";

// Resolves the bearer access token on an incoming /api/mcp request to the
// SaaS user it belongs to. This is the only place a raw MCP bearer token is
// ever looked at — every tool handler downstream only ever sees the
// resolved userId via AuthInfo.extra, never the token or another user's data.
export const resolveBearerAuth = async (request: Request): Promise<AuthInfo | null> => {
  const header = request.headers.get("authorization") || "";
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  if (!match) {
    return null;
  }

  const rawToken = match[1].trim();
  if (!rawToken) {
    return null;
  }

  const record = await prisma.mcpAccessToken.findUnique({
    where: { tokenHash: hashToken(rawToken) },
  });

  if (!record || record.revokedAt || record.expiresAt.getTime() < Date.now()) {
    return null;
  }

  void prisma.mcpAccessToken
    .update({ where: { id: record.id }, data: { lastUsedAt: new Date() } })
    .catch(() => {});

  return {
    token: rawToken,
    clientId: record.clientId,
    scopes: record.scope.split(" ").filter(Boolean),
    expiresAt: Math.floor(record.expiresAt.getTime() / 1000),
    extra: { userId: record.userId },
  };
};
