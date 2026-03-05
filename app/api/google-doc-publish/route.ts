import { NextResponse } from "next/server";
import { TokenReason } from "@prisma/client";
import { requireVerifiedUser } from "@/lib/auth-session";
import { readGoogleDocPost } from "@/lib/google-docs";
import { HttpError, toErrorResponse } from "@/lib/errors";
import { generateFeaturedImage } from "@/lib/openai";
import { googleDocImportRequestSchema } from "@/lib/schemas";
import { consumeTokens, TOKEN_COSTS } from "@/lib/tokens";
import { getUserWordPressConfig } from "@/lib/user-wordpress";
import { createPost, ensureCategory, uploadFeaturedMedia } from "@/lib/wp";
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
    if (payload.newCategoryName?.trim()) {
      categoryNames.add(payload.newCategoryName.trim());
    }

    for (const name of categoryNames) {
      const category = await ensureCategory(name, wpConfig);
      categoryIds.add(category.id);
    }

    const featuredImage =
      draft.featuredImageUrl
        ? await fetchImageAsBase64(draft.featuredImageUrl)
        : await generateFeaturedImage({
            title: draft.title,
            brief: draft.imagePrompt || draft.brief || draft.excerpt || draft.title,
          });

    const featuredMedia = await uploadFeaturedMedia(
      {
        imageBase64: featuredImage.imageBase64,
        mimeType: featuredImage.mimeType,
        title: draft.title,
        filenameSuggestion: `${draft.slug || "featured-image"}.png`,
        altText: `Featured image for ${draft.title}`,
      },
      wpConfig,
    );

    const scheduledAt =
      payload.status === "future" ? payload.scheduledAt : undefined;
    const createdPost = await createPost(
      {
        title: draft.title,
        slug: draft.slug || undefined,
        html: draft.html,
        excerpt: draft.excerpt || truncate(stripHtml(draft.html), 160) || draft.title,
        status: payload.status,
        date: scheduledAt,
        featuredMediaId: featuredMedia.id,
        categories: Array.from(categoryIds),
      },
      wpConfig,
    );

    const seoPayload = buildSeoPayload(draft);
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
        source: draft.featuredImageUrl ? "provided" : "generated",
      },
      categories: Array.from(categoryIds),
      seoUpdate,
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
