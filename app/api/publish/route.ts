import { NextResponse } from "next/server";
import { toErrorResponse } from "@/lib/errors";
import { publishRequestSchema } from "@/lib/schemas";
import {
  mapToAioseoFallbackMeta,
  mapToAioseoMetaData,
  mapToYoastMeta,
} from "@/lib/seo";
import { generateInlineArticleImages } from "@/lib/openai";
import {
  ensureCategory,
  createPost,
  updatePost,
  uploadFeaturedMedia,
  WpApiError,
} from "@/lib/wp";

export const runtime = "nodejs";

const AIOSEO_GUIDANCE =
  "AIOSEO metadata update failed. Confirm AIOSEO REST API addon is installed/enabled and this WordPress user can edit SEO fields.";

const YOAST_GUIDANCE =
  "Yoast metadata update failed. Yoast keys often must be registered with show_in_rest. Install wp-snippets/yoast-rest-meta.php as an MU-plugin and ensure the user can edit post meta.";

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

const normalizeWpError = (error: unknown) => {
  if (error instanceof WpApiError) {
    return {
      status: error.status,
      details: error.details ?? null,
      message: error.message,
    };
  }
  if (error instanceof Error) {
    return {
      message: error.message,
    };
  }
  return { message: "Unknown error." };
};

export async function POST(request: Request) {
  try {
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
    let featuredMediaId: number | undefined;
    let featuredImageUrl: string | undefined;
    const categoryIds = new Set<number>(payload.selectedCategoryIds);

    if (payload.newCategoryName?.trim()) {
      const createdOrExistingCategory = await ensureCategory(
        payload.newCategoryName.trim(),
      );
      categoryIds.add(createdOrExistingCategory.id);
    }

    if (payload.featuredImageBase64 && payload.featuredImageMime) {
      const media = await uploadFeaturedMedia({
        imageBase64: payload.featuredImageBase64,
        mimeType: payload.featuredImageMime,
        title: payload.title,
      });
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
        });

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
      featuredMediaId,
      categories: Array.from(categoryIds),
    });

    let seoUpdate: {
      ok: boolean;
      provider: "AIOSEO" | "Yoast" | "None";
      details: string;
      error?: unknown;
    } = {
      ok: true,
      provider: payload.seoProvider,
      details: "SEO update skipped because provider is None.",
    };

    if (payload.seoProvider === "AIOSEO") {
      const aioseoMetaData = mapToAioseoMetaData(
        payload.seoPayload,
        featuredImageUrl,
      );
      const aioseoMetaFallback = mapToAioseoFallbackMeta(
        payload.seoPayload,
        featuredImageUrl,
      );

      const attempts: Array<{
        label: string;
        body: Record<string, unknown>;
      }> = [
        {
          label: "aioseo_meta_data object payload",
          body: { aioseo_meta_data: aioseoMetaData },
        },
        {
          label: "aioseo_meta_data JSON string payload",
          body: { aioseo_meta_data: JSON.stringify(aioseoMetaData) },
        },
        {
          label: "AIOSEO fallback meta keys",
          body: { meta: aioseoMetaFallback },
        },
      ];

      const failedAttempts: Array<{ label: string; error: unknown }> = [];
      let aioseoApplied = false;
      for (const attempt of attempts) {
        try {
          await updatePost(createdPost.id, attempt.body);
          seoUpdate = {
            ok: true,
            provider: "AIOSEO",
            details: `AIOSEO update succeeded using: ${attempt.label}.`,
          };
          aioseoApplied = true;
          break;
        } catch (error) {
          failedAttempts.push({
            label: attempt.label,
            error: normalizeWpError(error),
          });
        }
      }

      if (!aioseoApplied) {
        seoUpdate = {
          ok: false,
          provider: "AIOSEO",
          details: AIOSEO_GUIDANCE,
          error: failedAttempts,
        };
      }
    }

    if (payload.seoProvider === "Yoast") {
      try {
        const meta = mapToYoastMeta(payload.seoPayload, featuredImageUrl);
        await updatePost(createdPost.id, { meta });
        seoUpdate = {
          ok: true,
          provider: "Yoast",
          details: "Yoast metadata update request completed.",
        };
      } catch (error) {
        const normalized = normalizeWpError(error);
        seoUpdate = {
          ok: false,
          provider: "Yoast",
          details: YOAST_GUIDANCE,
          error: normalized,
        };
      }
    }

    return NextResponse.json({
      postId: createdPost.id,
      link: createdPost.link,
      status: createdPost.status,
      categories: Array.from(categoryIds),
      inlineImages,
      seoUpdate,
      featuredImage: featuredMediaId
        ? { id: featuredMediaId, sourceUrl: featuredImageUrl }
        : null,
    });
  } catch (error) {
    return toErrorResponse(error, "Failed to publish post to WordPress.");
  }
}
