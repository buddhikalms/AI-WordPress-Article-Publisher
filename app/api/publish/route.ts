import { NextResponse } from "next/server";
import { TokenReason } from "@prisma/client";
import { HttpError, toErrorResponse } from "@/lib/errors";
import { publishRequestSchema } from "@/lib/schemas";
import { generateInlineArticleImages } from "@/lib/openai";
import { requireVerifiedUser } from "@/lib/auth-session";
import { getUserWordPressConfig } from "@/lib/user-wordpress";
import { consumeTokens, TOKEN_COSTS } from "@/lib/tokens";
import { applySeoUpdate } from "@/lib/wp-seo";
import {
  ensureCategory,
  ensureTag,
  createPost,
  uploadFeaturedMedia,
} from "@/lib/wp";

export const runtime = "nodejs";

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
export async function POST(request: Request) {
  try {
    const user = await requireVerifiedUser(request);
    if (user.tokenBalance < TOKEN_COSTS.PUBLISH_POST) {
      throw new HttpError(402, "Insufficient tokens. Please buy a package.");
    }
    const json = await request.json();
    const validation = publishRequestSchema.safeParse(json);
    if (!validation.success) {
      return NextResponse.json(
        {
          error: "Invalid request payload.",
          details: validation.error.flatten(),
        },
        { status: 400 },
      );
    }

    const payload = validation.data;
    const wpConfig = await getUserWordPressConfig(user.id, payload.siteId);
    let featuredMediaId: number | undefined;
    let featuredImageUrl: string | undefined;
    const categoryIds = new Set<number>(payload.selectedCategoryIds);
    const tagIds = new Set<number>(payload.selectedTagIds);
    const tagNames = new Set<string>([
      ...payload.newTagNames,
      ...payload.suggestedTags,
    ]);

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
      const media = await uploadFeaturedMedia({
        imageBase64: payload.featuredImageBase64,
        mimeType: payload.featuredImageMime,
        title: payload.title,
      }, wpConfig);
      featuredMediaId = media.id;
      featuredImageUrl = media.source_url;
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

    const requestId =
      request.headers.get("x-request-id") || crypto.randomUUID();
    const tokenCharge = await consumeTokens({
      userId: user.id,
      amount: TOKEN_COSTS.PUBLISH_POST,
      reason: TokenReason.PUBLISH_POST,
      action: "PUBLISH_POST",
      description: `Publish post \"${payload.title}\"`,
      requestId: `publish:${requestId}`,
      referenceType: "publish_post",
      referenceId: String(createdPost.id),
    });

    return NextResponse.json({
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
      tokenCharge: {
        charged: tokenCharge.charged,
        amount: TOKEN_COSTS.PUBLISH_POST,
        remaining: tokenCharge.tokenBalance,
      },
    });
  } catch (error) {
    return toErrorResponse(error, "Failed to publish post to WordPress.");
  }
}
