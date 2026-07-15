export type SEOProvider = "AIOSEO" | "Yoast" | "None";
export type PublishStatus = "draft" | "publish" | "future";
export type FollowType = "dofollow" | "nofollow";

export interface WordPressSiteSummary {
  id: string;
  name: string;
  baseUrl: string;
  username: string;
  updatedAt: string;
  isDefault: boolean;
}

export interface HyperlinkInput {
  url: string;
  anchorText: string;
  required: boolean;
  followType: FollowType;
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
  tokenCharge?: {
    charged: boolean;
    amount: number;
    remaining: number;
  };
}

export interface PublishRequest {
  siteId?: string;
  title: string;
  html: string;
  brief?: string;
  excerpt: string;
  status: PublishStatus;
  scheduledAt?: string;
  featuredImageBase64?: string;
  featuredImageMime?: string;
  inPostImageCount?: number;
  selectedCategoryIds?: number[];
  selectedCategoryNames?: string[];
  newCategoryName?: string;
  selectedTagIds?: number[];
  selectedTagNames?: string[];
  newTagNames?: string[] | string;
  suggestedTags?: string[];
  seoProvider: SEOProvider;
  seoPayload: SeoPayload;
}

export interface NewsAutoPublishRequest {
  siteId?: string;
  category: string;
  query?: string;
  language?: string;
  maxArticles: number;
  tone: string;
  wordCount: number;
  status: PublishStatus;
  scheduledAt?: string;
  selectedCategoryIds?: number[];
  newCategoryName?: string;
  selectedTagIds?: number[];
  newTagNames?: string[] | string;
  inPostImageCount?: number;
  seoProvider: SEOProvider;
}

export interface InlineGeneratedImage {
  imageBase64: string;
  mimeType: string;
  filenameSuggestion: string;
  altTextSuggestion: string;
  tokenCharge?: {
    charged: boolean;
    amount: number;
    remaining: number;
  };
}
