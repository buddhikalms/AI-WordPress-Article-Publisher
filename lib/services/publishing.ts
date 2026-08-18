import { TokenReason } from "@prisma/client";
import { HttpError } from "@/lib/errors";
import { generateInlineArticleImages } from "@/lib/openai";
import { getUserWordPressConfig } from "@/lib/user-wordpress";
import { consumeTokens, TOKEN_COSTS } from "@/lib/tokens";
import { applySeoUpdate } from "@/lib/wp-seo";
import {
  ensureCategory,
  ensureTag,
  createPost,
  uploadFeaturedMedia,
  WpApiError,
} from "@/lib/wp";
import type { PublishRequestPayload } from "@/lib/schemas";

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

const getMediaUploadWarning = (label: string, error: unknown) => {
  if (error instanceof WpApiError && (error.status === 401 || error.status === 403)) {
    return `${label} was skipped because WordPress refused media uploads for the selected site user. The article was still published without that image.`;
  }

  throw error;
};

export const publishArticleForUser = async (params: {
  userId: string;
  tokenBalance: number;
  requestId: string;
  payload: PublishRequestPayload;
}) => {
  const { payload } = params;

  if (params.tokenBalance < TOKEN_COSTS.PUBLISH_POST) {
    throw new HttpError(402, "Insufficient tokens. Please buy a package.");
  }

  const wpConfig = await getUserWordPressConfig(params.userId, payload.siteId);
  let featuredMediaId: number | undefined;
  let featuredImageUrl: string | undefined;
  const categoryIds = new Set<number>(payload.selectedCategoryIds);
  const tagIds = new Set<number>(payload.selectedTagIds);
  const warnings: string[] = [];
  const tagNames = new Set<string>([
    ...payload.selectedTagNames,
    ...payload.newTagNames,
    ...payload.suggestedTags,
  ]);

  for (const name of payload.selectedCategoryNames) {
    const createdOrExistingCategory = await ensureCategory(name, wpConfig);
    categoryIds.add(createdOrExistingCategory.id);
  }

  if (payload.newCategoryName?.trim()) {
    const createdOrExistingCategory = await ensureCategory(
      payload.newCategoryName.trim(),
      wpConfig,
    );
    categoryIds.add(createdOrExistingCategory.id);
  }

  for (const name of tagNames) {
    const createdOrExistingTag = await ensureTag(name, wpConfig);
    tagIds.add(createdOrExistingTag.id);
  }

  if (payload.featuredImageBase64 && payload.featuredImageMime) {
    try {
      const media = await uploadFeaturedMedia({
        imageBase64: payload.featuredImageBase64,
        mimeType: payload.featuredImageMime,
        title: payload.title,
      }, wpConfig);
      featuredMediaId = media.id;
      featuredImageUrl = media.source_url;
    } catch (error) {
      warnings.push(getMediaUploadWarning("Featured image", error));
    }
  }

  let htmlForPublish = payload.html;
  const inlineImages: Array<{ id: number; sourceUrl: string; altText?: string }> =
    [];

  if (payload.inPostImageCount > 0) {
    const generatedInlineImages = await generateInlineArticleImages({
      title: payload.title,
      brief: payload.brief || payload.excerpt || payload.title,
      count: payload.inPostImageCount,
    });

    for (let index = 0; index < generatedInlineImages.length; index += 1) {
      const generated = generatedInlineImages[index];
      try {
        const media = await uploadFeaturedMedia({
          imageBase64: generated.imageBase64,
          mimeType: generated.mimeType,
          title: `${payload.title} inline image ${index + 1}`,
          filenameSuggestion: generated.filenameSuggestion,
          altText: generated.altTextSuggestion,
        }, wpConfig);

        inlineImages.push({
          id: media.id,
          sourceUrl: media.source_url,
          altText: generated.altTextSuggestion,
        });
      } catch (error) {
        warnings.push(
          getMediaUploadWarning(`Inline image ${index + 1}`, error),
        );
      }
    }

    htmlForPublish = injectInlineImagesIntoHtml(htmlForPublish, inlineImages);
  }

  const createdPost = await createPost({
    title: payload.title,
    html: htmlForPublish,
    excerpt: payload.excerpt,
    status: payload.status,
    date: payload.status === "future" ? payload.scheduledAt : undefined,
    featuredMediaId,
    categories: Array.from(categoryIds),
    tags: Array.from(tagIds),
  }, wpConfig);

  const seoUpdate = await applySeoUpdate({
    postId: createdPost.id,
    provider: payload.seoProvider,
    seoPayload: payload.seoPayload,
    featuredImageUrl,
    wpConfig,
  });

  const tokenCharge = await consumeTokens({
    userId: params.userId,
    amount: TOKEN_COSTS.PUBLISH_POST,
    reason: TokenReason.PUBLISH_POST,
    action: "PUBLISH_POST",
    description: `Publish post "${payload.title}"`,
    requestId: `publish:${params.requestId}`,
    referenceType: "publish_post",
    referenceId: String(createdPost.id),
  });

  return {
    postId: createdPost.id,
    link: createdPost.link,
    status: createdPost.status,
    categories: Array.from(categoryIds),
    tags: Array.from(tagIds),
    inlineImages,
    seoUpdate,
    featuredImage: featuredMediaId
      ? { id: featuredMediaId, sourceUrl: featuredImageUrl }
      : null,
    warnings,
    tokenCharge: {
      charged: tokenCharge.charged,
      amount: TOKEN_COSTS.PUBLISH_POST,
      remaining: tokenCharge.tokenBalance,
    },
  };
};
