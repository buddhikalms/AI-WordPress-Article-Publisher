import { NextResponse } from "next/server";
import { toErrorResponse } from "@/lib/errors";
import { publishRequestSchema } from "@/lib/schemas";
import { mapToAioseoMetaData, mapToYoastMeta } from "@/lib/seo";
import {
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

    if (payload.featuredImageBase64 && payload.featuredImageMime) {
      const media = await uploadFeaturedMedia({
        imageBase64: payload.featuredImageBase64,
        mimeType: payload.featuredImageMime,
        title: payload.title,
      });
      featuredMediaId = media.id;
      featuredImageUrl = media.source_url;
    }

    const createdPost = await createPost({
      title: payload.title,
      html: payload.html,
      excerpt: payload.excerpt,
      status: payload.status,
      featuredMediaId,
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
      try {
        const aioseoMetaData = mapToAioseoMetaData(
          payload.seoPayload,
          featuredImageUrl,
        );
        await updatePost(createdPost.id, {
          aioseo_meta_data: aioseoMetaData,
        });
        seoUpdate = {
          ok: true,
          provider: "AIOSEO",
          details: "AIOSEO metadata update request completed.",
        };
      } catch (error) {
        const normalized = normalizeWpError(error);
        seoUpdate = {
          ok: false,
          provider: "AIOSEO",
          details: AIOSEO_GUIDANCE,
          error: normalized,
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
      seoUpdate,
      featuredImage: featuredMediaId
        ? { id: featuredMediaId, sourceUrl: featuredImageUrl }
        : null,
    });
  } catch (error) {
    return toErrorResponse(error, "Failed to publish post to WordPress.");
  }
}

