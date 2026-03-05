import { mapToAioseoFallbackMeta, mapToAioseoMetaData, mapToYoastMeta } from "@/lib/seo";
import type { SEOProvider, SeoPayload } from "@/lib/types";
import { type WpConfig, updatePost, WpApiError } from "@/lib/wp";

const AIOSEO_GUIDANCE =
  "AIOSEO metadata update failed. Confirm AIOSEO REST API addon is installed/enabled and this WordPress user can edit SEO fields.";

const YOAST_GUIDANCE =
  "Yoast metadata update failed. Yoast keys often must be registered with show_in_rest. Install wp-snippets/yoast-rest-meta.php as an MU-plugin and ensure the user can edit post meta.";

export interface SeoUpdateResult {
  ok: boolean;
  provider: SEOProvider;
  details: string;
  error?: unknown;
}

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

export const applySeoUpdate = async (params: {
  postId: number;
  provider: SEOProvider;
  seoPayload: SeoPayload;
  featuredImageUrl?: string;
  wpConfig: WpConfig;
}): Promise<SeoUpdateResult> => {
  if (params.provider === "None") {
    return {
      ok: true,
      provider: "None",
      details: "SEO update skipped because provider is None.",
    };
  }

  if (params.provider === "AIOSEO") {
    const aioseoMetaData = mapToAioseoMetaData(
      params.seoPayload,
      params.featuredImageUrl,
    );
    const aioseoMetaFallback = mapToAioseoFallbackMeta(
      params.seoPayload,
      params.featuredImageUrl,
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
    for (const attempt of attempts) {
      try {
        await updatePost(params.postId, attempt.body, params.wpConfig);
        return {
          ok: true,
          provider: "AIOSEO",
          details: `AIOSEO update succeeded using: ${attempt.label}.`,
        };
      } catch (error) {
        failedAttempts.push({
          label: attempt.label,
          error: normalizeWpError(error),
        });
      }
    }

    return {
      ok: false,
      provider: "AIOSEO",
      details: AIOSEO_GUIDANCE,
      error: failedAttempts,
    };
  }

  try {
    const meta = mapToYoastMeta(params.seoPayload, params.featuredImageUrl);
    await updatePost(params.postId, { meta }, params.wpConfig);
    return {
      ok: true,
      provider: "Yoast",
      details: "Yoast metadata update request completed.",
    };
  } catch (error) {
    return {
      ok: false,
      provider: "Yoast",
      details: YOAST_GUIDANCE,
      error: normalizeWpError(error),
    };
  }
};
