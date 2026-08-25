import { TokenReason } from "@prisma/client";
import { HttpError } from "@/lib/errors";
import { generateFeaturedImage, generateInlineArticleImages, rewriteNewsAsOriginalArticle } from "@/lib/ai";
import { resolveAiProviderCredential } from "@/lib/ai-credentials";
import { getUserWordPressConfig } from "@/lib/user-wordpress";
import { fetchNewsByCategory } from "@/lib/newsdata";
import { applySeoUpdate } from "@/lib/wp-seo";
import { consumeTokens, TOKEN_COSTS } from "@/lib/tokens";
import {
  createPost,
  ensureCategory,
  ensureTag,
  uploadFeaturedMedia,
} from "@/lib/wp";
import type { NewsAutoPublishRequestPayload } from "@/lib/schemas";

export const getTokensPerNewsPost = (skipImages: boolean) =>
  TOKEN_COSTS.ARTICLE_GENERATION +
  (skipImages ? 0 : TOKEN_COSTS.IMAGE_GENERATION) +
  TOKEN_COSTS.PUBLISH_POST;

const escapeHtmlAttribute = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

const buildInlineImageFigure = (image: {
  sourceUrl: string;
  altText?: string;
}) => {
  const altText = escapeHtmlAttribute(image.altText || "");
  const src = escapeHtmlAttribute(image.sourceUrl);
  return `<figure class="wp-block-image size-large"><img src="${src}" alt="${altText}" loading="lazy" decoding="async" /></figure>`;
};

const injectInlineImagesIntoHtml = (
  html: string,
  images: Array<{ sourceUrl: string; altText?: string }>,
) => {
  if (images.length === 0) {
    return html;
  }

  const parts = html.split(/<\/p>/i);
  if (parts.length <= 1) {
    const appended = images.map(buildInlineImageFigure).join("");
    return `${html}${appended}`;
  }

  const interval = Math.max(1, Math.floor(parts.length / (images.length + 1)));
  let imageIndex = 0;
  let output = "";

  for (let index = 0; index < parts.length; index += 1) {
    const part = parts[index];
    if (part.length > 0) {
      output += part;
    }
    if (index < parts.length - 1) {
      output += "</p>";
    }
    if (imageIndex < images.length && (index + 1) % interval === 0) {
      output += buildInlineImageFigure(images[imageIndex]);
      imageIndex += 1;
    }
  }

  while (imageIndex < images.length) {
    output += buildInlineImageFigure(images[imageIndex]);
    imageIndex += 1;
  }

  return output;
};

const getErrorSummary = (error: unknown) => {
  if (error instanceof HttpError) {
    return {
      status: error.status,
      message: error.message,
      details: error.details ?? null,
    };
  }
  if (error instanceof Error) {
    return {
      message: error.message,
    };
  }
  return {
    message: "Unknown error.",
  };
};

export const runNewsAutopilot = async (params: {
  userId: string;
  tokenBalance: number;
  requestSeed: string;
  payload: NewsAutoPublishRequestPayload;
}) => {
  const { payload } = params;
  const wpConfig = await getUserWordPressConfig(params.userId, payload.siteId);
  const categoryIds = new Set<number>(payload.selectedCategoryIds);
  const baseTagIds = new Set<number>(payload.selectedTagIds);
  if (payload.newCategoryName?.trim()) {
    const createdOrExistingCategory = await ensureCategory(
      payload.newCategoryName.trim(),
      wpConfig,
    );
    categoryIds.add(createdOrExistingCategory.id);
  }
  for (const name of payload.newTagNames) {
    const createdOrExistingTag = await ensureTag(name, wpConfig);
    baseTagIds.add(createdOrExistingTag.id);
  }

  const sourceArticles = await fetchNewsByCategory({
    category: payload.category,
    query: payload.query,
    language: payload.language,
    maxArticles: payload.maxArticles,
  });

  const tokensPerPost = getTokensPerNewsPost(payload.skipImages);
  const requiredTokens = sourceArticles.length * tokensPerPost;
  if (params.tokenBalance < requiredTokens) {
    throw new HttpError(
      402,
      `Insufficient tokens. Need at least ${requiredTokens} tokens for ${sourceArticles.length} news article(s).`,
    );
  }

  const baseScheduleTime =
    payload.status === "future" && payload.scheduledAt
      ? new Date(payload.scheduledAt).getTime()
      : null;

  const results: Array<{
    source: { title: string; link: string; sourceName?: string };
    postId: number;
    link: string;
    status: string;
    scheduledAt: string | null;
    categories: number[];
    tags: number[];
    inlineImages: Array<{ id: number; sourceUrl: string; altText?: string }>;
    seoUpdate: Awaited<ReturnType<typeof applySeoUpdate>>;
  }> = [];
  const failures: Array<{
    source: { title: string; link: string };
    error: unknown;
  }> = [];

  let tokenBalance = params.tokenBalance;

  for (let index = 0; index < sourceArticles.length; index += 1) {
    const source = sourceArticles[index];
    try {
      const credential = await resolveAiProviderCredential({
        userId: params.userId,
        provider: payload.provider || "gemini",
        requestedModel: payload.model,
      });
      const generated = await rewriteNewsAsOriginalArticle({
        article: source,
        category: payload.category,
        tone: payload.tone,
        wordCount: payload.wordCount,
        provider: payload.provider,
        model: credential.model || payload.model,
        apiKey: credential.apiKey,
      });
      const tagIds = new Set<number>(baseTagIds);
      for (const name of generated.meta.suggestedTags) {
        const createdOrExistingTag = await ensureTag(name, wpConfig);
        tagIds.add(createdOrExistingTag.id);
      }

      let featuredMedia: Awaited<ReturnType<typeof uploadFeaturedMedia>> | null = null;
      const imageCredential = !payload.skipImages
        ? await resolveAiProviderCredential({
            userId: params.userId,
            provider: payload.provider || "gemini",
            requestedModel: payload.provider === "openai" ? payload.model : undefined,
          })
        : null;
      if (!payload.skipImages) {
        const generatedImage = await generateFeaturedImage({
          title: generated.meta.title || source.title,
          brief: generated.meta.excerpt || source.description || source.title,
          provider: payload.provider || "gemini",
          model: payload.provider === "openai" ? imageCredential?.model || payload.model : undefined,
          apiKey: imageCredential?.apiKey,
        });

        featuredMedia = await uploadFeaturedMedia(
          {
            imageBase64: generatedImage.imageBase64,
            mimeType: generatedImage.mimeType,
            title: generated.meta.title || source.title,
            filenameSuggestion: generatedImage.filenameSuggestion,
            altText: generatedImage.altTextSuggestion,
          },
          wpConfig,
        );
      }

      let htmlForPublish = generated.html;
      const inlineImages: Array<{
        id: number;
        sourceUrl: string;
        altText?: string;
      }> = [];

      if (!payload.skipImages && payload.inPostImageCount > 0) {
        const generatedInlineImages = await generateInlineArticleImages({
          title: generated.meta.title || source.title,
          brief: generated.meta.excerpt || source.description || source.title,
          count: payload.inPostImageCount,
          provider: payload.provider || "gemini",
          model: payload.provider === "openai" ? imageCredential?.model || payload.model : undefined,
          apiKey: imageCredential?.apiKey,
        });

        for (
          let inlineIndex = 0;
          inlineIndex < generatedInlineImages.length;
          inlineIndex += 1
        ) {
          const generatedInline = generatedInlineImages[inlineIndex];
          const media = await uploadFeaturedMedia(
            {
              imageBase64: generatedInline.imageBase64,
              mimeType: generatedInline.mimeType,
              title: `${generated.meta.title || source.title} inline image ${inlineIndex + 1}`,
              filenameSuggestion: generatedInline.filenameSuggestion,
              altText: generatedInline.altTextSuggestion,
            },
            wpConfig,
          );

          inlineImages.push({
            id: media.id,
            sourceUrl: media.source_url,
            altText: generatedInline.altTextSuggestion,
          });
        }

        htmlForPublish = injectInlineImagesIntoHtml(htmlForPublish, inlineImages);
      }

      const scheduledAt =
        payload.status === "future" && baseScheduleTime !== null
          ? new Date(baseScheduleTime + index * 15 * 60 * 1000).toISOString()
          : undefined;

      const createdPost = await createPost(
        {
          title: generated.meta.title || source.title,
          html: htmlForPublish,
          excerpt: generated.meta.excerpt,
          status: payload.status,
          date: scheduledAt,
          featuredMediaId: featuredMedia?.id,
          categories: Array.from(categoryIds),
          tags: Array.from(tagIds),
        },
        wpConfig,
      );

      const seoUpdate = await applySeoUpdate({
        postId: createdPost.id,
        provider: payload.seoProvider,
        seoPayload: generated.meta.seo,
        featuredImageUrl: featuredMedia?.source_url,
        wpConfig,
      });

      const itemRequestId = `${params.requestSeed}:${index + 1}`;

      await consumeTokens({
        userId: params.userId,
        amount: TOKEN_COSTS.ARTICLE_GENERATION,
        reason: TokenReason.ARTICLE_GENERATION,
        action: "ARTICLE_GENERATION",
        description: `Rewrite news article "${source.title}"`,
        requestId: `news:article:${itemRequestId}`,
        referenceType: "news_rewrite",
        referenceId: source.link,
      });

      if (!payload.skipImages) {
        await consumeTokens({
          userId: params.userId,
          amount: TOKEN_COSTS.IMAGE_GENERATION,
          reason: TokenReason.IMAGE_GENERATION,
          action: "IMAGE_GENERATION",
          description: `Generate news image "${generated.meta.title || source.title}"`,
          requestId: `news:image:${itemRequestId}`,
          referenceType: "news_image",
          referenceId: String(createdPost.id),
        });
      }

      const publishCharge = await consumeTokens({
        userId: params.userId,
        amount: TOKEN_COSTS.PUBLISH_POST,
        reason: TokenReason.PUBLISH_POST,
        action: "PUBLISH_POST",
        description: `Publish news post "${generated.meta.title || source.title}"`,
        requestId: `news:publish:${itemRequestId}`,
        referenceType: "publish_post",
        referenceId: String(createdPost.id),
      });
      tokenBalance = publishCharge.tokenBalance;

      results.push({
        source: {
          title: source.title,
          link: source.link,
          sourceName: source.sourceName,
        },
        postId: createdPost.id,
        link: createdPost.link,
        status: createdPost.status,
        scheduledAt: scheduledAt || null,
        categories: Array.from(categoryIds),
        tags: Array.from(tagIds),
        inlineImages,
        seoUpdate,
      });
    } catch (error) {
      failures.push({
        source: {
          title: source.title,
          link: source.link,
        },
        error: getErrorSummary(error),
      });
    }
  }

  if (results.length === 0) {
    throw new HttpError(502, "Failed to auto-publish any news articles.", {
      failures,
    });
  }

  return {
    requested: payload.maxArticles,
    published: results.length,
    failed: failures.length,
    category: payload.category,
    status: payload.status,
    results,
    failures,
    tokenCharge: {
      amountPerPost: tokensPerPost,
      total: tokensPerPost * results.length,
      remaining: tokenBalance,
    },
  };
};
