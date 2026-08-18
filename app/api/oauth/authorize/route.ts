import { NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth-session";
import { prisma } from "@/lib/prisma";
import { findOAuthClient, isRedirectUriRegistered } from "@/lib/mcp/oauth-clients";
import { generateOpaqueToken, hashToken } from "@/lib/mcp/tokens";

export const runtime = "nodejs";

const AUTHORIZATION_CODE_TTL_MS = 5 * 60 * 1000;

export async function POST(request: Request) {
  const form = await request.formData();
  const decision = String(form.get("decision") || "");
  const responseType = String(form.get("response_type") || "code");
  const clientId = String(form.get("client_id") || "");
  const redirectUri = String(form.get("redirect_uri") || "");
  const codeChallenge = String(form.get("code_challenge") || "");
  const codeChallengeMethod = String(form.get("code_challenge_method") || "");
  const state = String(form.get("state") || "");
  const scope = String(form.get("scope") || "mcp");

  const client = await findOAuthClient(clientId);
  if (!client || !isRedirectUriRegistered(client, redirectUri)) {
    return NextResponse.json(
      { error: "invalid_request", error_description: "Unknown client or unregistered redirect_uri." },
      { status: 400 },
    );
  }

  const redirectTo = (params: Record<string, string>) => {
    const url = new URL(redirectUri);
    for (const [key, value] of Object.entries(params)) {
      if (value) {
        url.searchParams.set(key, value);
      }
    }
    return NextResponse.redirect(url.toString(), { status: 302 });
  };

  if (decision !== "approve") {
    return redirectTo({
      error: "access_denied",
      error_description: "The user denied the authorization request.",
      state,
    });
  }

  if (responseType !== "code" || !codeChallenge || codeChallengeMethod !== "S256") {
    return redirectTo({
      error: "invalid_request",
      error_description: "Missing or invalid PKCE parameters.",
      state,
    });
  }

  const session = await getCurrentSession();
  const userId = session?.user?.id;
  if (!userId) {
    const resumeParams = new URLSearchParams({
      response_type: responseType,
      client_id: clientId,
      redirect_uri: redirectUri,
      code_challenge: codeChallenge,
      code_challenge_method: codeChallengeMethod,
      state,
      scope,
    });
    const resumeUrl = `/oauth/authorize?${resumeParams.toString()}`;
    return NextResponse.redirect(
      `/login?callbackUrl=${encodeURIComponent(resumeUrl)}`,
      { status: 302 },
    );
  }

  if (!session.user?.emailVerified) {
    return redirectTo({
      error: "access_denied",
      error_description: "Please verify your email address before connecting an MCP client.",
      state,
    });
  }

  const rawCode = generateOpaqueToken();
  await prisma.mcpAuthorizationCode.create({
    data: {
      codeHash: hashToken(rawCode),
      clientId: client.clientId,
      userId,
      redirectUri,
      codeChallenge,
      codeChallengeMethod,
      scope,
      expiresAt: new Date(Date.now() + AUTHORIZATION_CODE_TTL_MS),
    },
  });

  return redirectTo({ code: rawCode, state });
}
