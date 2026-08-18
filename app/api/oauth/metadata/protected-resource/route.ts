import { NextResponse } from "next/server";
import { getMcpBaseUrl } from "@/lib/mcp/base-url";

export const runtime = "nodejs";

export async function GET() {
  const base = getMcpBaseUrl();

  return NextResponse.json({
    resource: `${base}/api/mcp`,
    authorization_servers: [base],
    bearer_methods_supported: ["header"],
    scopes_supported: ["mcp"],
  });
}
