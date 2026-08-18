import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { findOAuthClient } from "@/lib/mcp/oauth-clients";
import { verifyPkce } from "@/lib/mcp/pkce";
import { hashToken } from "@/lib/mcp/tokens";
import { issueTokenPair } from "@/lib/mcp/issue-tokens";
import { readFormOrJson } from "@/lib/mcp/http";

export const runtime = "nodejs";

const oauthError = (status: number, error: string, description: string) =>
  NextResponse.json(
    { error, error_description: description },
    { status, headers: { "Cache-Control": "no-store", Pragma: "no-cache" } },
  );

const tokenResponse = (tokens: {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  scope: string;
}) =>
  NextResponse.json(
    {
      access_token: tokens.accessToken,
      token_type: "Bearer",
      expires_in: tokens.expiresIn,
      refresh_token: tokens.refreshToken,
      scope: tokens.scope,
    },
    { headers: { "Cache-Control": "no-store", Pragma: "no-cache" } },
  );

const handleAuthorizationCodeGrant = async (fields: Map<string, string>) => {
  const code = fields.get("code") || "";
  const codeVerifier = fields.get("code_verifier") || "";
  const redirectUri = fields.get("redirect_uri") || "";
  const clientId = fields.get("client_id") || "";

  if (!code || !codeVerifier || !redirectUri || !clientId) {
    return oauthError(
      400,
      "invalid_request",
      "code, code_verifier, redirect_uri, and client_id are required.",
    );
  }

  const client = await findOAuthClient(clientId);
  if (!client) {
    return oauthError(400, "invalid_client", "Unknown client_id.");
  }

  const record = await prisma.mcpAuthorizationCode.findUnique({
    where: { codeHash: hashToken(code) },
  });

  if (
    !record ||
    record.consumedAt ||
    record.expiresAt.getTime() < Date.now() ||
    record.clientId !== client.clientId ||
    record.redirectUri !== redirectUri
  ) {
    return oauthError(400, "invalid_grant", "The authorization code is invalid, expired, or already used.");
  }

  if (!verifyPkce(codeVerifier, record.codeChallenge, record.codeChallengeMethod)) {
    return oauthError(400, "invalid_grant", "PKCE verification failed.");
  }

  const consumed = await prisma.mcpAuthorizationCode.updateMany({
    where: { id: record.id, consumedAt: null },
    data: { consumedAt: new Date() },
  });
  if (consumed.count !== 1) {
    return oauthError(400, "invalid_grant", "The authorization code was already used.");
  }

  const tokens = await issueTokenPair({
    userId: record.userId,
    clientId: client.clientId,
    scope: record.scope,
  });

  return tokenResponse({ ...tokens, scope: record.scope });
};

const handleRefreshTokenGrant = async (fields: Map<string, string>) => {
  const refreshToken = fields.get("refresh_token") || "";
  const clientId = fields.get("client_id") || "";

  if (!refreshToken || !clientId) {
    return oauthError(400, "invalid_request", "refresh_token and client_id are required.");
  }

  const client = await findOAuthClient(clientId);
  if (!client) {
    return oauthError(400, "invalid_client", "Unknown client_id.");
  }

  const record = await prisma.mcpRefreshToken.findUnique({
    where: { tokenHash: hashToken(refreshToken) },
  });

  if (
    !record ||
    record.revokedAt ||
    record.expiresAt.getTime() < Date.now() ||
    record.clientId !== client.clientId
  ) {
    return oauthError(400, "invalid_grant", "The refresh token is invalid, expired, or revoked.");
  }

  const revoked = await prisma.mcpRefreshToken.updateMany({
    where: { id: record.id, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  if (revoked.count !== 1) {
    return oauthError(400, "invalid_grant", "The refresh token was already used.");
  }

  const tokens = await issueTokenPair({
    userId: record.userId,
    clientId: client.clientId,
    scope: record.scope,
  });

  return tokenResponse({ ...tokens, scope: record.scope });
};

export async function POST(request: Request) {
  const fields = await readFormOrJson(request);
  const grantType = fields.get("grant_type") || "";

  if (grantType === "authorization_code") {
    return handleAuthorizationCodeGrant(fields);
  }
  if (grantType === "refresh_token") {
    return handleRefreshTokenGrant(fields);
  }
  return oauthError(
    400,
    "unsupported_grant_type",
    "grant_type must be authorization_code or refresh_token.",
  );
}
