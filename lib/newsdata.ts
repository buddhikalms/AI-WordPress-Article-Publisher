import { HttpError } from "@/lib/errors";

const DEFAULT_NEWSDATA_URL = "https://newsdata.io/api/1/news";

interface NewsDataArticle {
  title?: string | null;
  description?: string | null;
  content?: string | null;
  link?: string | null;
  image_url?: string | null;
  pubDate?: string | null;
  source_id?: string | null;
  source_name?: string | null;
  category?: string[] | null;
}

interface NewsDataResponse {
  status?: string;
  totalResults?: number;
  results?: NewsDataArticle[];
}

export interface NewsSourceArticle {
  title: string;
  description: string;
  content: string;
  link: string;
  imageUrl?: string;
  publishedAt?: string;
  sourceName?: string;
  categories: string[];
}

const stripHtml = (value: string) =>
  value
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const normalizeText = (value: string | null | undefined) => {
  if (!value) {
    return "";
  }
  return stripHtml(value).replace(/^only available.*$/i, "").trim();
};

const pickDescription = (article: NewsDataArticle) => {
  const description = normalizeText(article.description);
  if (description) {
    return description;
  }
  const content = normalizeText(article.content);
  if (content) {
    return content.slice(0, 260);
  }
  return "";
};

const pickContent = (article: NewsDataArticle) => {
  const content = normalizeText(article.content);
  if (content) {
    return content;
  }
  return normalizeText(article.description);
};

const normalizeArticle = (article: NewsDataArticle): NewsSourceArticle | null => {
  const title = normalizeText(article.title);
  const description = pickDescription(article);
  const content = pickContent(article);
  const link = (article.link || "").trim();

  if (!title || !description || !link) {
    return null;
  }

  return {
    title,
    description,
    content,
    link,
    imageUrl: article.image_url?.trim() || undefined,
    publishedAt: article.pubDate?.trim() || undefined,
    sourceName: article.source_name?.trim() || article.source_id?.trim() || undefined,
    categories: (article.category || [])
      .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
      .map((item) => item.trim()),
  };
};

export const fetchNewsByCategory = async (params: {
  category: string;
  query?: string;
  language?: string;
  maxArticles: number;
}): Promise<NewsSourceArticle[]> => {
  const apiKey = process.env.NEWSDATA_API_KEY?.trim();
  if (!apiKey) {
    throw new HttpError(
      500,
      "NEWSDATA_API_KEY is missing. Add it to your .env file.",
    );
  }

  const baseUrl = process.env.NEWSDATA_BASE_URL?.trim() || DEFAULT_NEWSDATA_URL;
  const url = new URL(baseUrl);
  const language = (params.language || "en").trim();
  const fetchSize = Math.max(params.maxArticles * 3, 10);

  url.searchParams.set("apikey", apiKey);
  url.searchParams.set("category", params.category.trim());
  url.searchParams.set("language", language);
  url.searchParams.set("size", String(Math.min(fetchSize, 50)));

  if (params.query?.trim()) {
    url.searchParams.set("q", params.query.trim());
  }

  const response = await fetch(url.toString(), {
    method: "GET",
    cache: "no-store",
  });

  const raw = await response.text();
  let parsed: NewsDataResponse | null = null;
  try {
    parsed = JSON.parse(raw) as NewsDataResponse;
  } catch {
    parsed = null;
  }

  if (!response.ok) {
    throw new HttpError(
      response.status,
      "NewsData API request failed.",
      parsed ?? raw.slice(0, 500),
    );
  }

  if (!parsed || parsed.status !== "success") {
    throw new HttpError(502, "NewsData API returned an invalid response.", parsed ?? raw);
  }

  const dedupe = new Set<string>();
  const normalized = (parsed.results || [])
    .map(normalizeArticle)
    .filter((item): item is NewsSourceArticle => item !== null)
    .filter((item) => {
      const key = `${item.link.toLowerCase()}|${item.title.toLowerCase()}`;
      if (dedupe.has(key)) {
        return false;
      }
      dedupe.add(key);
      return true;
    });

  if (normalized.length === 0) {
    throw new HttpError(404, "No usable news articles were returned for this category.");
  }

  return normalized.slice(0, params.maxArticles);
};
