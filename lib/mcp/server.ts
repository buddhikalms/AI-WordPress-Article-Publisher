import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerSiteTools } from "@/lib/mcp/tools/sites";
import { registerArticleTools } from "@/lib/mcp/tools/articles";
import { registerNewsTools } from "@/lib/mcp/tools/news";

// One fresh McpServer per request (see app/api/mcp/route.ts) — matches how
// every other route in this app is stateless, and avoids needing shared
// in-memory session state across serverless invocations.
export const createMcpServer = () => {
  const server = new McpServer({
    name: "ai-article-publisher",
    version: "1.0.0",
  });

  registerSiteTools(server);
  registerArticleTools(server);
  registerNewsTools(server);

  return server;
};
