import { TokenReason } from "@prisma/client";
import { HttpError } from "@/lib/errors";
import { getUserWordPressConfig } from "@/lib/user-wordpress";
import { consumeTokens, TOKEN_COSTS } from "@/lib/tokens";
import { applySeoUpdate } from "@/lib/wp-seo";
import { enforceLinkPoliciesInHtml } from "@/lib/link-validation";
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

const getImgAltText = (imgTag: string) => {
  const altMatch = imgTag.match(/\balt\s*=\s*(["'])(.*?)\1/i);
  return altMatch?.[2] || "";
};

const replaceImgSrc = (imgTag: string, sourceUrl: string) => {
  const escapedSource = escapeHtmlAttribute(sourceUrl);
  if (/\bsrc\s*=/i.test(imgTag)) {
    return imgTag.replace(/\bsrc\s*=\s*(["'])(.*?)\1/i, `src="${escapedSource}"`);
  }
  return imgTag.replace(/>$/, ` src="${escapedSource}">`);
};

const getMediaUploadWarning = (label: string, error: unknown) => {
  if (error instanceof WpApiError && (error.status === 401 || error.status === 403)) {
    return `${label} was skipped because WordPress refused media uploads for the selected site user. The article was still published without that image.`;
  }
  if (error instanceof WpApiError) {
    return `${label} was skipped because WordPress media upload failed: ${error.message} The article was still published without that image.`;
  }

  throw error;
};

const uploadEmbeddedDataImages = async (
  html: string,
  params: {
    title: string;
    wpConfig: Awaited<ReturnType<typeof getUserWordPressConfig>>;
    warnings: string[];
  },
) => {
  const imageRegex =
    /<img\b[^>]*\bsrc\s*=\s*(["'])(data:([^;]+);base64,.*?)\1[^>]*>/gis;
  const matches = Array.from(html.matchAll(imageRegex));
  if (matches.length === 0) {
    return html;
  }

  let nextHtml = html;
  for (let index = 0; index < matches.length; index += 1) {
    const match = matches[index];
    const imgTag = match[0];
    const dataUrl = match[2];
    const mimeType = match[3] || "image/png";
    const altText = getImgAltText(imgTag);

    try {
      const media = await uploadFeaturedMedia(
        {
          imageBase64: dataUrl,
          mimeType,
          title: `${params.title} editor image ${index + 1}`,
          filenameSuggestion: `${params.title}-editor-${index + 1}`,
          altText,
        },
        params.wpConfig,
      );
      nextHtml = nextHtml.replace(imgTag, replaceImgSrc(imgTag, media.source_url));
    } catch (error) {
      params.warnings.push(
        getMediaUploadWarning(`Editor image ${index + 1}`, error),
      );
    }
  }

  return nextHtml;
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

  let htmlForPublish = enforceLinkPoliciesInHtml(payload.html, payload.links);
  const inlineImages: Array<{ id: number; sourceUrl: string; altText?: string }> =
    [];

  if (payload.inPostImageCount > 0) {
    warnings.push(
      "In-post AI image generation is skipped during WordPress publish. Generate and insert images before publishing, or use News Autopilot for AI image generation.",
    );
  }

  htmlForPublish = await uploadEmbeddedDataImages(htmlForPublish, {
    title: payload.title,
    wpConfig,
    warnings,
  });

  const createdPost = await createPost({
    title: payload.title,
    slug: payload.slug,
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
