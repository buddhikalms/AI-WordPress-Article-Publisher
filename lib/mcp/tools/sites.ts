import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { runTool } from "@/lib/mcp/tool-context";
import {
  listWordPressCredentialSummaries,
  getUserWordPressConfig,
} from "@/lib/services/wordpress-sites";
import { getCurrentUser, listCategories, listTags } from "@/lib/wp";

const withTimeout = <T>(promise: Promise<T>, ms: number): Promise<T> =>
  Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error("timeout")), ms);
    }),
  ]);

export const registerSiteTools = (server: McpServer) => {
  server.registerTool(
    "list_wordpress_sites",
    {
      title: "List WordPress sites",
      description:
        "List the authenticated user's connected WordPress sites with a best-effort live connection status. Never returns credentials.",
      annotations: { readOnlyHint: true },
    },
    async (extra) =>
      runTool({
        extra,
        tool: "list_wordpress_sites",
        action: "list_sites",
        fn: async (ctx) => {
          const sites = await listWordPressCredentialSummaries(ctx.userId);
          const withStatus = await Promise.all(
            sites.map(async (site) => {
              let connectionStatus: "connected" | "error" = "error";
              try {
                const config = await getUserWordPressConfig(ctx.userId, site.id);
                await withTimeout(getCurrentUser(config), 4000);
                connectionStatus = "connected";
              } catch {
                connectionStatus = "error";
              }
              return {
                id: site.id,
                name: site.name,
                baseUrl: site.baseUrl,
                isDefault: site.isDefault,
                connectionStatus,
              };
            }),
          );
          return { data: { sites: withStatus } };
        },
      }),
  );

  server.registerTool(
    "get_wordpress_categories",
    {
      title: "Get WordPress categories",
      description: "List categories for one connected WordPress site.",
      inputSchema: { site_id: z.string().min(1) },
      annotations: { readOnlyHint: true },
    },
    async ({ site_id }, extra) =>
      runTool({
        extra,
        tool: "get_wordpress_categories",
        action: "list_categories",
        siteId: site_id,
        fn: async (ctx) => {
          const config = await getUserWordPressConfig(ctx.userId, site_id);
          const categories = await listCategories(config);
          return { data: { categories } };
        },
      }),
  );

  server.registerTool(
    "get_wordpress_tags",
    {
      title: "Get WordPress tags",
      description: "List tags for one connected WordPress site.",
      inputSchema: { site_id: z.string().min(1) },
      annotations: { readOnlyHint: true },
    },
    async ({ site_id }, extra) =>
      runTool({
        extra,
        tool: "get_wordpress_tags",
        action: "list_tags",
        siteId: site_id,
        fn: async (ctx) => {
          const config = await getUserWordPressConfig(ctx.userId, site_id);
          const tags = await listTags(config);
          return { data: { tags } };
        },
      }),
  );
};
