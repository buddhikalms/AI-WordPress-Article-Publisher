import { NextResponse } from "next/server";
import { TokenReason } from "@prisma/client";
import { requireVerifiedUser } from "@/lib/auth-session";
import { readGoogleDocPost } from "@/lib/google-docs";
import { HttpError, toErrorResponse } from "@/lib/errors";
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

const normalizeImageSourceKey = (value: string) => {
  const decodedEntities = value
    .replace(/&amp;/g, "&")
    .replace(/&#38;/g, "&")
    .replace(/^data:(image\/[a-z0-9.+-]+;base64,)/i, "$1")
    .trim();

  try {
    return decodeURI(decodedEntities);
  } catch {
    return decodedEntities;
  }
};

const getImageReplacement = (
  replacements: Map<string, { sourceUrl: string; altText: string; title: string }>,
  src: string,
) => {
  const candidates = [
    src,
    src.replace(/&amp;/g, "&"),
    normalizeImageSourceKey(src),
  ];

  for (const candidate of candidates) {
    const replacement = replacements.get(candidate);
    if (replacement) {
      return replacement;
    }
  }

  return undefined;
};

const replaceImageSources = (
  html: string,
  replacements: Map<string, { sourceUrl: string; altText: string; title: string }>,
) => {
  return html.replace(/<img\b[^>]*>/gi, (imageTag) => {
    const srcMatch = imageTag.match(/\bsrc\s*=\s*(["'])(.*?)\1/i);
    const src = srcMatch?.[2]?.replace(/&amp;/g, "&") || "";
    const replacement = getImageReplacement(replacements, src);
    if (!replacement) {
      return imageTag;
    }

    let updated = imageTag.replace(
      /\bsrc\s*=\s*(["'])(.*?)\1/i,
      `src="${replacement.sourceUrl}"`,
    );
    const attributes = {
      alt: replacement.altText,
      title: replacement.title,
    };
    Object.entries(attributes).forEach(([name, value]) => {
      const escaped = value.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
      if (new RegExp(`\\b${name}\\s*=`, "i").test(updated)) {
        updated = updated.replace(
          new RegExp(`\\b${name}\\s*=\\s*(["'])(.*?)\\1`, "i"),
          `${name}="${escaped}"`,
        );
      } else {
        updated = updated.replace(/\s*\/?>$/, ` ${name}="${escaped}" />`);
      }
    });
    return updated;
  });
};

const setAnchorAttribute = (anchorTag: string, attribute: string, value: string) => {
  const escaped = value.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
  const withoutAttribute = anchorTag.replace(
    new RegExp(`\\s*\\b${attribute}\\s*=\\s*(["'])(.*?)\\1`, "i"),
    "",
  );
  return withoutAttribute.replace(/>$/, ` ${attribute}="${escaped}">`);
};

const openLinksInNewTabs = (html: string) =>
  html.replace(/<a\b[^>]*>/gi, (anchorTag) => {
    const href = anchorTag.match(/\bhref\s*=\s*(["'])(.*?)\1/i)?.[2] || "";
    if (!href || href.startsWith("#")) {
      return anchorTag;
    }
    return setAnchorAttribute(
      setAnchorAttribute(anchorTag, "target", "_blank"),
      "rel",
      "noopener noreferrer",
    );
  });

const removeImageSourceFromHtml = (html: string, imageUrl?: string) => {
  if (!imageUrl?.trim()) {
    return html;
  }

  const quotedUrl = imageUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  let updated = html;
  for (const tagName of ["figure", "p"]) {
    updated = updated.replace(
      new RegExp(`<${tagName}\\b[^>]*>[\\s\\S]*?<\\/${tagName}>`, "gi"),
      (block) => {
        if (!new RegExp(`<img\\b[^>]*\\bsrc\\s*=\\s*(["'])${quotedUrl}\\1`, "i").test(block)) {
          return block;
        }
        const withoutImages = block.replace(/<img\b[^>]*>/gi, "");
        return stripHtml(withoutImages) ? withoutImages : "";
      },
    );
  }

  updated = updated.replace(
    new RegExp(`<img\\b[^>]*\\bsrc\\s*=\\s*(["'])${quotedUrl}\\1[^>]*>`, "gi"),
    "",
  );
  return updated.replace(/<p\b[^>]*>\s*<\/p>/gi, "").trim();
};

const hasPublishablePostContent = (html: string) => {
  if (stripHtml(html).length >= 80) {
    return true;
  }
  return /<(h[1-6]|p|ul|ol|figure|img)\b/i.test(html);
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

    const requiredTokens = TOKEN_COSTS.PUBLISH_POST;
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

    const docImages: typeof draft.images = draft.images.length > 0
      ? draft.images
      : draft.imageUrls.map((url) => ({ url, altText: "", title: "" }));
    const uploadedDocImages: Array<{
      originalUrl: string;
      id: number;
      sourceUrl: string;
      altText: string;
      title: string;
    }> = [];
    const imageSourceReplacements = new Map<
      string,
      { sourceUrl: string; altText: string; title: string }
    >();

    for (let index = 0; index < docImages.length; index += 1) {
      const docImage = docImages[index];
      const originalUrl = docImage.url;
      const downloaded =
        docImage.imageBase64 && docImage.mimeType
          ? {
              imageBase64: docImage.imageBase64,
              mimeType: docImage.mimeType,
            }
          : await fetchImageAsBase64(originalUrl);
      const mediaTitle = docImage.title || docImage.altText || `${draft.title} image ${index + 1}`;
      const altText =
        docImage.altText ||
        docImage.title ||
        (index === 0
          ? `Featured image for ${draft.title}`
          : `Image ${index + 1} for ${draft.title}`);
      const uploaded = await uploadFeaturedMedia(
        {
          imageBase64: downloaded.imageBase64,
          mimeType: downloaded.mimeType,
          title: mediaTitle,
          filenameSuggestion: `${draft.slug || "google-doc"}-${index + 1}`,
          altText,
        },
        wpConfig,
      );

      uploadedDocImages.push({
        originalUrl,
        id: uploaded.id,
        sourceUrl: uploaded.source_url,
        altText,
        title: mediaTitle,
      });
      imageSourceReplacements.set(originalUrl, {
        sourceUrl: uploaded.source_url,
        altText,
        title: mediaTitle,
      });
      imageSourceReplacements.set(normalizeImageSourceKey(originalUrl), {
        sourceUrl: uploaded.source_url,
        altText,
        title: mediaTitle,
      });
    }

    const featuredMedia = uploadedDocImages[0]
      ? {
          id: uploadedDocImages[0].id,
          source_url: uploadedDocImages[0].sourceUrl,
        }
      : null;

    const htmlForPublish = removeImageSourceFromHtml(
      openLinksInNewTabs(
        replaceImageSources(
          draft.html,
          imageSourceReplacements,
        ),
      ),
      featuredMedia?.source_url,
    );
    if (!hasPublishablePostContent(htmlForPublish)) {
      throw new HttpError(
        400,
        "Google Doc content could not be converted into a publishable post body. Please check that the document has readable text below the title and try again.",
        { documentId: draft.documentId },
      );
    }

    const scheduledAt =
      payload.status === "future" ? payload.scheduledAt : undefined;
    const excerpt =
      draft.excerpt || truncate(stripHtml(htmlForPublish), 160) || draft.title;
    const createdPost = await createPost(
      {
        title: draft.title,
        slug: draft.slug || undefined,
        html: htmlForPublish,
        excerpt,
        status: payload.status,
        date: scheduledAt,
        featuredMediaId: featuredMedia?.id,
        categories: Array.from(categoryIds),
        tags: Array.from(tagIds),
      },
      wpConfig,
    );

    const seoPayload = buildSeoPayload(draft);
    const seoUpdate = await applySeoUpdate({
      postId: createdPost.id,
      provider: payload.seoProvider,
      seoPayload,
      featuredImageUrl: featuredMedia?.source_url,
      wpConfig,
    });

    const requestSeed =
      request.headers.get("x-request-id") || crypto.randomUUID();

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
      featuredImage: featuredMedia
        ? {
            id: featuredMedia.id,
            sourceUrl: featuredMedia.source_url,
            source: "google-doc",
          }
        : null,
      importedImages: uploadedDocImages,
      categories: Array.from(categoryIds),
      tags: Array.from(tagIds),
      seoUpdate,
      seoSource: payload.seoProvider === "None" ? "skipped" : "google-doc",
      seoFilled: {
        seoTitle: !draft.seoTitle,
        metaDescription: !draft.metaDescription,
        focusKeyword: !draft.focusKeyword,
        canonicalUrl: !draft.canonicalUrl,
      },
      tokenCharge: {
        total: TOKEN_COSTS.PUBLISH_POST,
        remaining: publishCharge.tokenBalance,
      },
    });
  } catch (error) {
    return toErrorResponse(error, "Failed to publish post from Google Doc.");
  }
}
