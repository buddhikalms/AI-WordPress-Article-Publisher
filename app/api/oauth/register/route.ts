import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getErrorMessage } from "@/lib/errors";
import { isAllowedRedirectUri } from "@/lib/mcp/oauth-clients";
import { generateClientId } from "@/lib/mcp/tokens";

export const runtime = "nodejs";

// RFC 7591 Dynamic Client Registration. This server only issues public
// clients (PKCE-only, no client secret); every authorization request must
// carry an S256 code_challenge, so there is no secret to leak or rotate.
const registerRequestSchema = z.object({
  redirect_uris: z.array(z.string()).min(1),
  client_name: z.string().trim().min(1).max(200).optional(),
  token_endpoint_auth_method: z.string().optional(),
  grant_types: z.array(z.string()).optional(),
  response_types: z.array(z.string()).optional(),
  scope: z.string().optional(),
});

const toRedirectUrisInput = (redirectUris: string[]) =>
  redirectUris as unknown as string;

const oauthError = (status: number, error: string, description: string) =>
  NextResponse.json(
    { error, error_description: description },
    { status, headers: { "Cache-Control": "no-store", Pragma: "no-cache" } },
  );

export async function POST(request: Request) {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return oauthError(400, "invalid_client_metadata", "Request body must be JSON.");
  }

  const validation = registerRequestSchema.safeParse(json);
  if (!validation.success) {
    return oauthError(
      400,
      "invalid_client_metadata",
      validation.error.issues.map((issue) => issue.message).join("; "),
    );
  }

  const payload = validation.data;

  if (
    payload.token_endpoint_auth_method &&
    payload.token_endpoint_auth_method !== "none"
  ) {
    return oauthError(
      400,
      "invalid_client_metadata",
      "Only public clients (token_endpoint_auth_method=none) are supported; use PKCE (S256).",
    );
  }

  const grantTypes = payload.grant_types ?? ["authorization_code", "refresh_token"];
  const allowedGrantTypes = new Set(["authorization_code", "refresh_token"]);
  if (!grantTypes.every((grant) => allowedGrantTypes.has(grant))) {
    return oauthError(
      400,
      "invalid_client_metadata",
      "grant_types may only include authorization_code and refresh_token.",
    );
  }

  const responseTypes = payload.response_types ?? ["code"];
  if (!responseTypes.every((type) => type === "code")) {
    return oauthError(
      400,
      "invalid_client_metadata",
      "response_types may only include code.",
    );
  }

  const invalidRedirectUri = payload.redirect_uris.find(
    (uri) => !isAllowedRedirectUri(uri),
  );
  if (invalidRedirectUri) {
    return oauthError(
      400,
      "invalid_redirect_uri",
      `redirect_uris must be absolute https URLs (or http://localhost for local development): ${invalidRedirectUri}`,
    );
  }

  let client: { clientId: string; clientName: string; createdAt: Date };
  try {
    const clientId = generateClientId();
    client = await prisma.mcpOAuthClient.create({
      data: {
        clientId,
        clientName: payload.client_name?.trim() || "MCP Client",
        redirectUris: toRedirectUrisInput(payload.redirect_uris),
      },
      select: {
        clientId: true,
        clientName: true,
        createdAt: true,
      },
    });
  } catch (error) {
    console.error("MCP dynamic client registration failed", error);
    return oauthError(
      503,
      "temporarily_unavailable",
      `Dynamic client registration storage is unavailable. Run Prisma migrations and verify DATABASE_URL. ${getErrorMessage(error)}`,
    );
  }

  return NextResponse.json(
    {
      client_id: client.clientId,
      client_name: client.clientName,
      redirect_uris: payload.redirect_uris,
      grant_types: grantTypes,
      response_types: responseTypes,
      token_endpoint_auth_method: "none",
      client_id_issued_at: Math.floor(client.createdAt.getTime() / 1000),
    },
    { status: 201, headers: { "Cache-Control": "no-store", Pragma: "no-cache" } },
  );
}
