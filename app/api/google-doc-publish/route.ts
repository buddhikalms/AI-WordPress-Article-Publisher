import { NextResponse } from "next/server";
import { TokenReason } from "@prisma/client";
import { requireVerifiedUser } from "@/lib/auth-session";
import { readGoogleDocPost } from "@/lib/google-docs";
import { HttpError, toErrorResponse } from "@/lib/errors";
import { generateFeaturedImage, generateSeoPayloadForArticle } from "@/lib/openai";
import { googleDocImportRequestSchema } from "@/lib/schemas";
import { consumeTokens, TOKEN_COSTS } from "@/lib/tokens";
import { getUserWordPressConfig } from "@/lib/user-wordpress";
import { createPost, ensureCategory, ensureTag, uploadFeaturedMedia } from "@/lib/wp";
import { applySeoUpdate } from "@/lib/wp-seo";

export const runtime = "nodejs";

const stripHtml = (value: string) =>
  value
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const truncate = (value: string, maxLength: number) =>
  value.length <= maxLength ? value : `${value.slice(0, maxLength - 1).trim()}...`;

const buildSeoPayload = (draft: Awaited<ReturnType<typeof readGoogleDocPost>>) => {
  const fallbackDescription =
    draft.excerpt || truncate(stripHtml(draft.html), 160) || draft.title;
  const focusKeyword =
    draft.focusKeyword ||
    draft.slug
      .split("-")
      .filter(Boolean)
      .slice(0, 4)
      .join(" ") ||
    draft.title;

  return {
    seoTitle: draft.seoTitle || draft.title,
    metaDescription: draft.metaDescription || fallbackDescription,
    focusKeyword,
    canonicalUrl: draft.canonicalUrl,
    og: {
      title: draft.seoTitle || draft.title,
      description: draft.metaDescription || fallbackDescription,
      imageUrl: undefined,
    },
    twitter: {
      title: draft.seoTitle || draft.title,
      description: draft.metaDescription || fallbackDescription,
      imageUrl: undefined,
    },
  };
};

const fetchImageAsBase64 = async (url: string) => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new HttpError(
      502,
      `Failed to download featured image from ${url}.`,
      { status: response.status },
    );
  }

  const mimeType = response.headers.get("content-type")?.split(";")[0]?.trim();
  if (!mimeType || !mimeType.startsWith("image/")) {
    throw new HttpError(400, "Featured image URL did not return an image.", {
      url,
      mimeType: mimeType || null,
    });
  }

  const bytes = Buffer.from(await response.arrayBuffer());
  return {
    imageBase64: bytes.toString("base64"),
    mimeType,
  };
};

const escapeRegExp = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const replaceImageSources = (
  html: string,
  replacements: Map<string, string>,
) => {
  let updated = html;
  replacements.forEach((nextUrl, originalUrl) => {
    updated = updated.replace(
      new RegExp(`(src\\s*=\\s*["'])${escapeRegExp(originalUrl)}(["'])`, "g"),
      `$1${nextUrl}$2`,
    );
    updated = updated.replace(
      new RegExp(
        `(src\\s*=\\s*["'])${escapeRegExp(originalUrl.replace(/&/g, "&amp;"))}(["'])`,
        "g",
      ),
      `$1${nextUrl}$2`,
    );
  });
  return updated;
};

export async function POST(request: Request) {
  try {
    const user = await requireVerifiedUser(request);
    const json = await request.json();
    const validation = googleDocImportRequestSchema.safeParse(json);

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
    const draft = await readGoogleDocPost({
      document: payload.document,
    });

    const needsGeneratedImage = !draft.featuredImageUrl;
    const requiredTokens =
      TOKEN_COSTS.PUBLISH_POST +
      (needsGeneratedImage ? TOKEN_COSTS.IMAGE_GENERATION : 0);
    if (user.tokenBalance < requiredTokens) {
      throw new HttpError(
        402,
        `Insufficient tokens. Need at least ${requiredTokens} tokens for this Google Doc post.`,
      );
    }

    const categoryIds = new Set<number>(payload.selectedCategoryIds);
    const categoryNames = new Set<string>(draft.categories);
    const tagIds = new Set<number>(payload.selectedTagIds);
    const tagNames = new Set<string>([
      ...draft.tags,
      ...payload.newTagNames,
    ]);
    if (payload.newCategoryName?.trim()) {
      categoryNames.add(payload.newCategoryName.trim());
    }

    for (const name of categoryNames) {
      const category = await ensureCategory(name, wpConfig);
      categoryIds.add(category.id);
    }

    for (const name of tagNames) {
      const tag = await ensureTag(name, wpConfig);
      tagIds.add(tag.id);
    }

    const docImageUrls = [
      ...new Set(
        [
          draft.featuredImageUrl,
          ...draft.imageUrls,
        ].filter((url): url is string => Boolean(url)),
      ),
    ];
    const uploadedDocImages: Array<{
      originalUrl: string;
      id: number;
      sourceUrl: string;
    }> = [];
    const imageSourceReplacements = new Map<string, string>();

    for (let index = 0; index < docImageUrls.length; index += 1) {
      const originalUrl = docImageUrls[index];
      const downloaded = await fetchImageAsBase64(originalUrl);
      const uploaded = await uploadFeaturedMedia(
        {
          imageBase64: downloaded.imageBase64,
          mimeType: downloaded.mimeType,
          title: `${draft.title} image ${index + 1}`,
          filenameSuggestion: `${draft.slug || "google-doc"}-${index + 1}`,
          altText:
            index === 0
              ? `Featured image for ${draft.title}`
              : `Image ${index + 1} for ${draft.title}`,
        },
        wpConfig,
      );

      uploadedDocImages.push({
        originalUrl,
        id: uploaded.id,
        sourceUrl: uploaded.source_url,
      });
      imageSourceReplacements.set(originalUrl, uploaded.source_url);
    }

    const generatedFeaturedImage =
      uploadedDocImages.length === 0
        ? await generateFeaturedImage({
            title: draft.title,
            brief: draft.imagePrompt || draft.brief || draft.excerpt || draft.title,
          })
        : null;

    const featuredMedia = uploadedDocImages[0]
      ? {
          id: uploadedDocImages[0].id,
          source_url: uploadedDocImages[0].sourceUrl,
        }
      : await uploadFeaturedMedia(
          {
            imageBase64: generatedFeaturedImage!.imageBase64,
            mimeType: generatedFeaturedImage!.mimeType,
            title: draft.title,
            filenameSuggestion: `${draft.slug || "featured-image"}.png`,
            altText: `Featured image for ${draft.title}`,
          },
          wpConfig,
        );

    const htmlForPublish = replaceImageSources(
      draft.html,
      imageSourceReplacements,
    );

    const scheduledAt =
      payload.status === "future" ? payload.scheduledAt : undefined;
    const excerpt =
      draft.excerpt || truncate(stripHtml(draft.html), 160) || draft.title;
    const createdPost = await createPost(
      {
        title: draft.title,
        slug: draft.slug || undefined,
        html: htmlForPublish,
        excerpt,
        status: payload.status,
        date: scheduledAt,
        featuredMediaId: featuredMedia.id,
        categories: Array.from(categoryIds),
        tags: Array.from(tagIds),
      },
      wpConfig,
    );

    const seoPayload =
      payload.seoProvider === "None"
        ? buildSeoPayload(draft)
        : await generateSeoPayloadForArticle({
            title: draft.title,
            html: htmlForPublish,
            excerpt,
            focusKeyword: draft.focusKeyword,
            canonicalUrl: draft.canonicalUrl,
          });
    const seoUpdate = await applySeoUpdate({
      postId: createdPost.id,
      provider: payload.seoProvider,
      seoPayload,
      featuredImageUrl: featuredMedia.source_url,
      wpConfig,
    });

    const requestSeed =
      request.headers.get("x-request-id") || crypto.randomUUID();

    if (needsGeneratedImage) {
      await consumeTokens({
        userId: user.id,
        amount: TOKEN_COSTS.IMAGE_GENERATION,
        reason: TokenReason.IMAGE_GENERATION,
        action: "IMAGE_GENERATION",
        description: `Generate Google Doc post image "${draft.title}"`,
        requestId: `gdoc:image:${requestSeed}`,
        referenceType: "google_doc_image",
        referenceId: String(createdPost.id),
      });
    }

    const publishCharge = await consumeTokens({
      userId: user.id,
      amount: TOKEN_COSTS.PUBLISH_POST,
      reason: TokenReason.PUBLISH_POST,
      action: "PUBLISH_POST",
      description: `Publish Google Doc post "${draft.title}"`,
      requestId: `gdoc:publish:${requestSeed}`,
      referenceType: "publish_post",
      referenceId: String(createdPost.id),
    });

    return NextResponse.json({
      documentId: draft.documentId,
      documentName: draft.documentName,
      title: draft.title,
      slug: draft.slug,
      postId: createdPost.id,
      link: createdPost.link,
      status: createdPost.status,
      scheduledAt: scheduledAt || null,
      featuredImage: {
        id: featuredMedia.id,
        sourceUrl: featuredMedia.source_url,
        source: uploadedDocImages.length > 0 ? "google-doc" : "generated",
      },
      importedImages: uploadedDocImages,
      categories: Array.from(categoryIds),
      tags: Array.from(tagIds),
      seoUpdate,
      seoSource: payload.seoProvider === "None" ? "skipped" : "ai",
      seoFilled: {
        seoTitle: !draft.seoTitle,
        metaDescription: !draft.metaDescription,
        focusKeyword: !draft.focusKeyword,
        canonicalUrl: !draft.canonicalUrl,
      },
      tokenCharge: {
        total:
          TOKEN_COSTS.PUBLISH_POST +
          (needsGeneratedImage ? TOKEN_COSTS.IMAGE_GENERATION : 0),
        remaining: publishCharge.tokenBalance,
      },
    });
  } catch (error) {
    return toErrorResponse(error, "Failed to publish post from Google Doc.");
  }
}
