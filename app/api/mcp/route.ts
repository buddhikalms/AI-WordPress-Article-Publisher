import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { createMcpServer } from "@/lib/mcp/server";
import { resolveBearerAuth } from "@/lib/mcp/context";
import { getMcpBaseUrl } from "@/lib/mcp/base-url";

export const runtime = "nodejs";

const unauthorized = () => {
  const base = getMcpBaseUrl();
  return new Response(
    JSON.stringify({
      error: "unauthorized",
      error_description: "A valid MCP access token is required.",
    }),
    {
      status: 401,
      headers: {
        "Content-Type": "application/json",
        "WWW-Authenticate": `Bearer resource_metadata="${base}/.well-known/oauth-protected-resource"`,
      },
    },
  );
};

// Stateless per-request MCP handling: a fresh server + transport is built
// for every call, matching how every other route in this app already works
// with no shared in-memory session state across invocations.
const handle = async (request: Request) => {
  const authInfo = await resolveBearerAuth(request);
  if (!authInfo) {
    return unauthorized();
  }

  const server = createMcpServer();
  const transport = new WebStandardStreamableHTTPServerTransport({
    enableJsonResponse: true,
  });
  await server.connect(transport);
  return transport.handleRequest(request, { authInfo });
};

export const POST = handle;
export const GET = handle;
export const DELETE = handle;
