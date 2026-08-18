import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { HttpError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { runTool } from "@/lib/mcp/tool-context";
import { getUserWordPressConfig } from "@/lib/services/wordpress-sites";
import { publishArticleForUser } from "@/lib/services/publishing";
import { getPost, searchPosts, updatePost } from "@/lib/wp";
import { applySeoUpdate } from "@/lib/wp-seo";
import { publishRequestSchema, seoProviderSchema } from "@/lib/schemas";

const postStatusEnum = z.enum([
  "publish",
  "draft",
  "pending",
  "future",
  "private",
  "trash",
]);

const fetchImageAsBase64 = async (url: string) => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new HttpError(502, `Failed to download image from ${url}.`);
  }
  const mimeType = response.headers.get("content-type")?.split(";")[0]?.trim();
  if (!mimeType || !mimeType.startsWith("image/")) {
    throw new HttpError(400, `${url} did not return an image.`);
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  return { imageBase64: bytes.toString("base64"), mimeType };
};

export const registerArticleTools = (server: McpServer) => {
  server.registerTool(
    "search_articles",
    {
      title: "Search WordPress articles",
      description: "Search articles on one connected WordPress site by keyword and status.",
      inputSchema: {
        site_id: z.string().min(1),
        query: z.string().optional(),
        status: postStatusEnum.array().max(6).optional(),
        limit: z.number().int().min(1).max(50).default(10),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ site_id, query, status, limit }, extra) =>
      runTool({
        extra,
        tool: "search_articles",
        action: "search_articles",
        siteId: site_id,
        fn: async (ctx) => {
          const config = await getUserWordPressConfig(ctx.userId, site_id);
          const posts = await searchPosts(
            query || "",
            { status, limit },
            config,
          );
          return { data: { posts } };
        },
      }),
  );

  server.registerTool(
    "get_article",
    {
      title: "Get WordPress article",
      description: "Fetch full details (including content) for one WordPress post.",
      inputSchema: {
        site_id: z.string().min(1),
        post_id: z.number().int().positive(),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ site_id, post_id }, extra) =>
      runTool({
        extra,
        tool: "get_article",
        action: "get_article",
        siteId: site_id,
        fn: async (ctx) => {
          const config = await getUserWordPressConfig(ctx.userId, site_id);
          const post = await getPost(post_id, config);
          return { data: { post }, wordpressPostId: post_id };
        },
      }),
  );

  server.registerTool(
    "create_article_draft",
    {
      title: "Create WordPress article draft",
      description:
        "Create a new WordPress post as a draft. This never publishes — use publish_article to make it live.",
      inputSchema: {
        site_id: z.string().min(1),
        title: z.string().trim().min(3),
        content: z.string().trim().min(20),
        excerpt: z.string().trim().min(1),
        categories: z.array(z.string()).optional(),
        tags: z.array(z.string()).optional(),
        featured_image_url: z.string().url().optional(),
        seo_provider: seoProviderSchema.default("None"),
        seo_title: z.string().optional(),
        meta_description: z.string().optional(),
        focus_keyword: z.string().optional(),
        canonical_url: z.string().url().optional(),
        og_title: z.string().optional(),
        og_description: z.string().optional(),
        twitter_title: z.string().optional(),
        twitter_description: z.string().optional(),
        request_id: z.string().optional(),
      },
      annotations: { destructiveHint: false },
    },
    async (input, extra) =>
      runTool({
        extra,
        tool: "create_article_draft",
        action: "create_draft",
        siteId: input.site_id,
        fn: async (ctx) => {
          const user = await prisma.user.findUnique({
            where: { id: ctx.userId },
            select: { tokenBalance: true },
          });
          if (!user) {
            throw new HttpError(404, "User not found.");
          }

          let featuredImageBase64: string | undefined;
          let featuredImageMime: string | undefined;
          if (input.featured_image_url) {
            const downloaded = await fetchImageAsBase64(input.featured_image_url);
            featuredImageBase64 = downloaded.imageBase64;
            featuredImageMime = downloaded.mimeType;
          }

          const seoTitle = input.seo_title || input.title;
          const metaDescription = input.meta_description || input.excerpt;

          const validation = publishRequestSchema.safeParse({
            siteId: input.site_id,
            title: input.title,
            html: input.content,
            brief: input.excerpt,
            excerpt: input.excerpt,
            status: "draft",
            featuredImageBase64,
            featuredImageMime,
            inPostImageCount: 0,
            selectedCategoryIds: [],
            selectedCategoryNames: input.categories || [],
            selectedTagIds: [],
            selectedTagNames: input.tags || [],
            newTagNames: [],
            suggestedTags: [],
            seoProvider: input.seo_provider,
            seoPayload: {
              seoTitle,
              metaDescription,
              focusKeyword: input.focus_keyword || input.title,
              canonicalUrl: input.canonical_url,
              og: {
                title: input.og_title || seoTitle,
                description: input.og_description || metaDescription,
              },
              twitter: {
                title: input.twitter_title || seoTitle,
                description: input.twitter_description || metaDescription,
              },
            },
          });

          if (!validation.success) {
            throw new HttpError(400, "Invalid article draft payload.", validation.error.flatten());
          }

          const result = await publishArticleForUser({
            userId: ctx.userId,
            tokenBalance: user.tokenBalance,
            requestId: input.request_id || crypto.randomUUID(),
            payload: validation.data,
          });

          return {
            data: result,
            wordpressPostId: result.postId,
            tokensSpent: result.tokenCharge.amount,
          };
        },
      }),
  );

  server.registerTool(
    "update_article",
    {
      title: "Update WordPress article",
      description:
        "Update an existing WordPress post's title, content, excerpt, categories, tags, or SEO fields. Cannot publish a post — use publish_article for that.",
      inputSchema: {
        site_id: z.string().min(1),
        post_id: z.number().int().positive(),
        title: z.string().trim().min(3).optional(),
        content: z.string().trim().min(20).optional(),
        excerpt: z.string().trim().optional(),
        category_ids: z.array(z.number().int().positive()).optional(),
        tag_ids: z.array(z.number().int().positive()).optional(),
        status: z.enum(["draft", "pending", "private"]).optional(),
        seo_provider: seoProviderSchema.optional(),
        seo_title: z.string().optional(),
        meta_description: z.string().optional(),
        focus_keyword: z.string().optional(),
        canonical_url: z.string().url().optional(),
      },
    },
    async (input, extra) =>
      runTool({
        extra,
        tool: "update_article",
        action: "update_article",
        siteId: input.site_id,
        fn: async (ctx) => {
          const config = await getUserWordPressConfig(ctx.userId, input.site_id);

          const updatePayload: Record<string, unknown> = {};
          if (input.title !== undefined) updatePayload.title = input.title;
          if (input.content !== undefined) updatePayload.content = input.content;
          if (input.excerpt !== undefined) updatePayload.excerpt = input.excerpt;
          if (input.category_ids !== undefined) updatePayload.categories = input.category_ids;
          if (input.tag_ids !== undefined) updatePayload.tags = input.tag_ids;
          if (input.status !== undefined) updatePayload.status = input.status;

          const updated =
            Object.keys(updatePayload).length > 0
              ? await updatePost(input.post_id, updatePayload, config)
              : null;

          let seoUpdate = null;
          if (
            input.seo_provider &&
            input.seo_provider !== "None" &&
            (input.seo_title || input.meta_description || input.focus_keyword || input.canonical_url)
          ) {
            const seoTitle = input.seo_title || input.title || "";
            const metaDescription = input.meta_description || input.excerpt || "";
            seoUpdate = await applySeoUpdate({
              postId: input.post_id,
              provider: input.seo_provider,
              seoPayload: {
                seoTitle,
                metaDescription,
                focusKeyword: input.focus_keyword || seoTitle,
                canonicalUrl: input.canonical_url,
                og: { title: seoTitle, description: metaDescription },
                twitter: { title: seoTitle, description: metaDescription },
              },
              wpConfig: config,
            });
          }

          return { data: { updated, seoUpdate }, wordpressPostId: input.post_id };
        },
      }),
  );

  server.registerTool(
    "publish_article",
    {
      title: "Publish WordPress article",
      description:
        "Publish an existing WordPress draft/pending post immediately. This is the only tool that makes a post live — use it only after the user explicitly asks to publish.",
      inputSchema: {
        site_id: z.string().min(1),
        post_id: z.number().int().positive(),
      },
      annotations: { destructiveHint: true },
    },
    async ({ site_id, post_id }, extra) =>
      runTool({
        extra,
        tool: "publish_article",
        action: "publish_article",
        siteId: site_id,
        fn: async (ctx) => {
          const config = await getUserWordPressConfig(ctx.userId, site_id);
          const updated = await updatePost(post_id, { status: "publish" }, config);
          return { data: { updated }, wordpressPostId: post_id };
        },
      }),
  );
};
