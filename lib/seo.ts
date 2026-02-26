import type { SEOProvider, SeoPayload } from "@/lib/types";

const getResolvedImage = (
  preferred?: string,
  fallback?: string,
): string | undefined => {
  if (preferred && preferred.trim()) {
    return preferred.trim();
  }
  if (fallback && fallback.trim()) {
    return fallback.trim();
  }
  return undefined;
};

const isAbsoluteUrl = (value: string) => {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
};

export const mapToAioseoMetaData = (
  seo: SeoPayload,
  featuredImageUrl?: string,
): Record<string, unknown> => {
  const ogImage = getResolvedImage(seo.og.imageUrl, featuredImageUrl);
  const twitterImage = getResolvedImage(
    seo.twitter.imageUrl,
    featuredImageUrl,
  );

  const payload: Record<string, unknown> = {
    title: seo.seoTitle,
    description: seo.metaDescription,
    focus_keyphrase: seo.focusKeyword,
    focus_keyword: seo.focusKeyword,
    og_title: seo.og.title,
    og_description: seo.og.description,
    twitter_title: seo.twitter.title,
    twitter_description: seo.twitter.description,
    social: {
      facebook: {
        title: seo.og.title,
        description: seo.og.description,
        image: ogImage,
      },
      twitter: {
        title: seo.twitter.title,
        description: seo.twitter.description,
        image: twitterImage,
      },
    },
  };

  if (seo.canonicalUrl) {
    payload.canonical_url = seo.canonicalUrl;
  }
  if (ogImage) {
    payload.og_image = ogImage;
  }
  if (twitterImage) {
    payload.twitter_image = twitterImage;
  }

  return payload;
};

export const mapToAioseoFallbackMeta = (
  seo: SeoPayload,
  featuredImageUrl?: string,
): Record<string, string> => {
  const ogImage = getResolvedImage(seo.og.imageUrl, featuredImageUrl);
  const twitterImage = getResolvedImage(
    seo.twitter.imageUrl,
    featuredImageUrl,
  );

  const meta: Record<string, string> = {
    _aioseo_title: seo.seoTitle,
    _aioseo_description: seo.metaDescription,
    _aioseo_focus_keyphrase: seo.focusKeyword,
    _aioseo_og_title: seo.og.title,
    _aioseo_og_description: seo.og.description,
    _aioseo_twitter_title: seo.twitter.title,
    _aioseo_twitter_description: seo.twitter.description,
  };

  if (seo.canonicalUrl) {
    meta._aioseo_canonical_url = seo.canonicalUrl;
  }
  if (ogImage && isAbsoluteUrl(ogImage)) {
    meta._aioseo_og_image = ogImage;
  }
  if (twitterImage && isAbsoluteUrl(twitterImage)) {
    meta._aioseo_twitter_image = twitterImage;
  }

  return meta;
};

export const mapToYoastMeta = (
  seo: SeoPayload,
  featuredImageUrl?: string,
): Record<string, string> => {
  const ogImage = getResolvedImage(seo.og.imageUrl, featuredImageUrl);
  const twitterImage = getResolvedImage(
    seo.twitter.imageUrl,
    featuredImageUrl,
  );

  const meta: Record<string, string> = {
    _yoast_wpseo_title: seo.seoTitle,
    _yoast_wpseo_metadesc: seo.metaDescription,
    _yoast_wpseo_focuskw: seo.focusKeyword,
    "_yoast_wpseo_opengraph-title": seo.og.title,
    "_yoast_wpseo_opengraph-description": seo.og.description,
    "_yoast_wpseo_twitter-title": seo.twitter.title,
    "_yoast_wpseo_twitter-description": seo.twitter.description,
  };

  if (seo.canonicalUrl) {
    meta._yoast_wpseo_canonical = seo.canonicalUrl;
  }
  if (ogImage && isAbsoluteUrl(ogImage)) {
    meta["_yoast_wpseo_opengraph-image"] = ogImage;
  }
  if (twitterImage && isAbsoluteUrl(twitterImage)) {
    meta["_yoast_wpseo_twitter-image"] = twitterImage;
  }

  return meta;
};

export const getProviderPayloadPreview = (
  provider: SEOProvider,
  seoPayload: SeoPayload,
  featuredImageUrlPlaceholder?: string,
) => {
  if (provider === "AIOSEO") {
    return {
      provider,
      payload: mapToAioseoMetaData(seoPayload, featuredImageUrlPlaceholder),
    };
  }
  if (provider === "Yoast") {
    return {
      provider,
      payload: {
        meta: mapToYoastMeta(seoPayload, featuredImageUrlPlaceholder),
      },
    };
  }
  return {
    provider,
    payload: null,
    note: "SEO updates are disabled when provider is None.",
  };
};
