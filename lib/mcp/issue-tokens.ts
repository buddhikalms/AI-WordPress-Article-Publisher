import { prisma } from "@/lib/prisma";
import { generateOpaqueToken, hashToken } from "@/lib/mcp/tokens";

export const ACCESS_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour
export const REFRESH_TOKEN_TTL_MS = 90 * 24 * 60 * 60 * 1000; // 90 days

export const issueTokenPair = async (params: {
  userId: string;
  clientId: string;
  scope: string;
}) => {
  const accessTokenRaw = generateOpaqueToken();
  const refreshTokenRaw = generateOpaqueToken();
  const accessExpiresAt = new Date(Date.now() + ACCESS_TOKEN_TTL_MS);
  const refreshExpiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);

  await prisma.$transaction([
    prisma.mcpAccessToken.create({
      data: {
        tokenHash: hashToken(accessTokenRaw),
        clientId: params.clientId,
        userId: params.userId,
        scope: params.scope,
        expiresAt: accessExpiresAt,
      },
    }),
    prisma.mcpRefreshToken.create({
      data: {
        tokenHash: hashToken(refreshTokenRaw),
        clientId: params.clientId,
        userId: params.userId,
        scope: params.scope,
        expiresAt: refreshExpiresAt,
      },
    }),
  ]);

  return {
    accessToken: accessTokenRaw,
    refreshToken: refreshTokenRaw,
    expiresIn: Math.floor(ACCESS_TOKEN_TTL_MS / 1000),
  };
};
