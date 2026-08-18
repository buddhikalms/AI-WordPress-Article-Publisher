import { z } from "zod";
import { TokenReason } from "@prisma/client";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { HttpError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { runTool } from "@/lib/mcp/tool-context";
import { fetchNewsByCategory } from "@/lib/newsdata";
import { rewriteNewsAsOriginalArticle } from "@/lib/ai";
import { generateFeaturedImage } from "@/lib/openai";
import { runNewsAutopilot } from "@/lib/services/news-autopilot";
import { consumeTokens, TOKEN_COSTS } from "@/lib/tokens";
import {
  aiProviderSchema,
  newsAutoPublishRequestSchema,
  newsCategorySchema,
  seoProviderSchema,
} from "@/lib/schemas";

export const registerNewsTools = (server: McpServer) => {
  server.registerTool(
    "search_news",
    {
      title: "Search news",
      description: "Search current news by category, keyword, and language via NewsData. The API key is never exposed.",
      inputSchema: {
        category: newsCategorySchema,
        query: z.string().optional(),
        language: z.string().min(2).max(10).optional(),
        limit: z.number().int().min(1).max(10).default(5),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ category, query, language, limit }, extra) =>
      runTool({
        extra,
        tool: "search_news",
        action: "search_news",
        fn: async () => {
          const articles = await fetchNewsByCategory({
            category,
            query,
            language,
            maxArticles: limit,
          });
          return { data: { articles } };
        },
      }),
  );

  server.registerTool(
    "generate_news_article",
    {
      title: "Generate an original article from a news source",
      description:
        "Rewrite one news item (from search_news) into an original, SEO-ready draft. Returns the draft only — it is never published or saved to WordPress.",
      inputSchema: {
        source_title: z.string().trim().min(1),
        source_description: z.string().optional(),
        source_content: z.string().optional(),
        source_link: z.string().url(),
        source_name: z.string().optional(),
        published_at: z.string().optional(),
        category: z.string().default("technology"),
        tone: z.string().default("Professional"),
        word_count: z.number().int().min(300).max(5000).default(1200),
        provider: aiProviderSchema.optional(),
        model: z.string().optional(),
        generate_featured_image: z.boolean().default(false),
        request_id: z.string().optional(),
      },
    },
    async (input, extra) =>
      runTool({
        extra,
        tool: "generate_news_article",
        action: "generate_news_article",
        fn: async (ctx) => {
          const user = await prisma.user.findUnique({
            where: { id: ctx.userId },
            select: { tokenBalance: true },
          });
          if (!user) {
            throw new HttpError(404, "User not found.");
          }
          const requiredTokens =
            TOKEN_COSTS.ARTICLE_GENERATION +
            (input.generate_featured_image ? TOKEN_COSTS.IMAGE_GENERATION : 0);
          if (user.tokenBalance < requiredTokens) {
            throw new HttpError(402, "Insufficient tokens. Please buy a package.");
          }

          const generated = await rewriteNewsAsOriginalArticle({
            category: input.category,
            tone: input.tone,
            wordCount: input.word_count,
            provider: input.provider,
            model: input.model,
            article: {
              title: input.source_title,
              description: input.source_description || "",
              content: input.source_content || "",
              link: input.source_link,
              sourceName: input.source_name,
              publishedAt: input.published_at,
              categories: [input.category],
            },
          });

          const requestId = input.request_id || crypto.randomUUID();
          const articleCharge = await consumeTokens({
            userId: ctx.userId,
            amount: TOKEN_COSTS.ARTICLE_GENERATION,
            reason: TokenReason.ARTICLE_GENERATION,
            action: "ARTICLE_GENERATION",
            description: `MCP generate_news_article for "${input.source_title}"`,
            requestId: `mcp:news-article:${requestId}`,
            referenceType: "mcp_news_article",
            referenceId: input.source_link,
          });

          let featuredImage: Awaited<ReturnType<typeof generateFeaturedImage>> | null = null;
          let tokensSpent = TOKEN_COSTS.ARTICLE_GENERATION;
          if (input.generate_featured_image) {
            featuredImage = await generateFeaturedImage({
              title: generated.meta.title || input.source_title,
              brief: generated.meta.excerpt || input.source_description || input.source_title,
            });
            const imageCharge = await consumeTokens({
              userId: ctx.userId,
              amount: TOKEN_COSTS.IMAGE_GENERATION,
              reason: TokenReason.IMAGE_GENERATION,
              action: "IMAGE_GENERATION",
              description: `MCP generate_news_article featured image for "${input.source_title}"`,
              requestId: `mcp:news-image:${requestId}`,
              referenceType: "mcp_news_image",
              referenceId: input.source_link,
            });
            tokensSpent += imageCharge.charged ? TOKEN_COSTS.IMAGE_GENERATION : 0;
          }

          return {
            data: {
              html: generated.html,
              meta: generated.meta,
              featuredImage,
              tokenBalance: articleCharge.tokenBalance,
            },
            tokensSpent,
          };
        },
      }),
  );

  server.registerTool(
    "news_autopilot",
    {
      title: "Run news autopilot",
      description:
        "Fetch fresh news for a category, rewrite each into an original article, optionally generate images, and create WordPress posts. Defaults to draft status — pass status='publish' only when the user explicitly asks to publish immediately.",
      inputSchema: {
        site_id: z.string().min(1),
        category: newsCategorySchema,
        query: z.string().optional(),
        language: z.string().min(2).max(10).optional(),
        article_count: z.number().int().min(1).max(5).default(1),
        tone: z.string().default("Professional"),
        word_count: z.number().int().min(300).max(5000).default(1200),
        generate_featured_image: z.boolean().default(true),
        in_post_image_count: z.number().int().min(0).max(10).default(0),
        seo_provider: seoProviderSchema.default("None"),
        status: z.enum(["draft", "publish"]).default("draft"),
        provider: aiProviderSchema.optional(),
        model: z.string().optional(),
        request_id: z.string().optional(),
      },
    },
    async (input, extra) =>
      runTool({
        extra,
        tool: "news_autopilot",
        action: "news_autopilot",
        siteId: input.site_id,
        fn: async (ctx) => {
          const user = await prisma.user.findUnique({
            where: { id: ctx.userId },
            select: { tokenBalance: true },
          });
          if (!user) {
            throw new HttpError(404, "User not found.");
          }

          const validation = newsAutoPublishRequestSchema.safeParse({
            siteId: input.site_id,
            category: input.category,
            query: input.query,
            language: input.language,
            maxArticles: input.article_count,
            tone: input.tone,
            wordCount: input.word_count,
            status: input.status,
            selectedCategoryIds: [],
            selectedTagIds: [],
            newTagNames: [],
            inPostImageCount: input.in_post_image_count,
            seoProvider: input.seo_provider,
            provider: input.provider,
            model: input.model,
            skipImages: !input.generate_featured_image,
          });

          if (!validation.success) {
            throw new HttpError(400, "Invalid news_autopilot payload.", validation.error.flatten());
          }

          const result = await runNewsAutopilot({
            userId: ctx.userId,
            tokenBalance: user.tokenBalance,
            requestSeed: input.request_id || crypto.randomUUID(),
            payload: validation.data,
          });

          return { data: result, tokensSpent: result.tokenCharge.total };
        },
      }),
  );
};
