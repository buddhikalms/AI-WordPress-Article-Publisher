export type SEOProvider = "AIOSEO" | "Yoast" | "None";
export type PublishStatus = "draft" | "publish";

export interface HyperlinkInput {
  url: string;
  anchorText: string;
  required: boolean;
}

export interface SocialMeta {
  title: string;
  description: string;
  imageUrl?: string;
}

export interface SeoPayload {
  seoTitle: string;
  metaDescription: string;
  focusKeyword: string;
  canonicalUrl?: string;
  og: SocialMeta;
  twitter: SocialMeta;
}

export interface GeneratedArticleMeta {
  title: string;
  excerpt: string;
  suggestedTags: string[];
  seo: SeoPayload;
}

export interface GenerateArticleResponse {
  html: string;
  meta: GeneratedArticleMeta;
}

export interface PublishRequest {
  title: string;
  html: string;
  excerpt: string;
  status: PublishStatus;
  featuredImageBase64?: string;
  featuredImageMime?: string;
  seoProvider: SEOProvider;
  seoPayload: SeoPayload;
}

