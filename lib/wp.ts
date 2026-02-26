import { HttpError } from "@/lib/errors";

export class WpApiError extends HttpError {
  constructor(status: number, message: string, details?: unknown) {
    super(status, message, details);
    this.name = "WpApiError";
  }
}

interface WpConfig {
  baseUrl: string;
  username: string;
  appPassword: string;
}

interface WpMediaResponse {
  id: number;
  source_url: string;
}

interface WpPostResponse {
  id: number;
  link: string;
  status: string;
}

export interface WpCategory {
  id: number;
  name: string;
  slug: string;
  count?: number;
}

const getWpConfig = (): WpConfig => {
  const baseUrl = process.env.WORDPRESS_BASE_URL?.trim();
  const username = process.env.WORDPRESS_USERNAME?.trim();
  const appPassword = process.env.WORDPRESS_APP_PASSWORD?.trim();

  if (!baseUrl || !username || !appPassword) {
    throw new HttpError(
      500,
      "WordPress credentials are missing. Set WORDPRESS_BASE_URL, WORDPRESS_USERNAME, and WORDPRESS_APP_PASSWORD in .env.local.",
    );
  }

  return { baseUrl: baseUrl.replace(/\/+$/, ""), username, appPassword };
};

const buildWpUrl = (path: string) => {
  const { baseUrl } = getWpConfig();
  if (/^https?:\/\//i.test(path)) {
    return path;
  }
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${baseUrl}${normalizedPath}`;
};

const splitPathAndQuery = (path: string) => {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const queryIndex = normalizedPath.indexOf("?");
  if (queryIndex === -1) {
    return {
      pathname: normalizedPath,
      queryString: "",
    };
  }
  return {
    pathname: normalizedPath.slice(0, queryIndex),
    queryString: normalizedPath.slice(queryIndex + 1),
  };
};

const buildFallbackWpUrl = (path: string) => {
  const { baseUrl } = getWpConfig();
  if (/^https?:\/\//i.test(path)) {
    return null;
  }
  const { pathname, queryString } = splitPathAndQuery(path);
  if (!pathname.startsWith("/wp-json/")) {
    return null;
  }

  const restRoute = pathname.replace(/^\/wp-json/, "") || "/";
  const url = new URL(`${baseUrl}/index.php`);
  url.searchParams.set("rest_route", restRoute.startsWith("/") ? restRoute : `/${restRoute}`);

  if (queryString) {
    const params = new URLSearchParams(queryString);
    params.forEach((value, key) => {
      url.searchParams.append(key, value);
    });
  }

  return url.toString();
};

const buildAuthHeader = () => {
  const { username, appPassword } = getWpConfig();
  const token = Buffer.from(`${username}:${appPassword}`).toString("base64");
  return `Basic ${token}`;
};

const parseWpResponseBody = async (response: Response) => {
  const bodyText = await response.text();
  if (!bodyText) {
    return null;
  }
  try {
    return JSON.parse(bodyText) as unknown;
  } catch {
    return bodyText;
  }
};

const isHtmlResponse = (response: Response, parsedBody: unknown) => {
  const contentType = response.headers.get("content-type")?.toLowerCase() || "";
  if (contentType.includes("text/html")) {
    return true;
  }
  return typeof parsedBody === "string" && parsedBody.trim().startsWith("<!DOCTYPE html");
};

const wpRequest = async <T>(path: string, init: RequestInit = {}): Promise<T> => {
  const headers = new Headers(init.headers);
  headers.set("Authorization", buildAuthHeader());

  const body = init.body;
  const hasBinaryBody =
    body instanceof Uint8Array || body instanceof ArrayBuffer;
  const hasBody = body !== undefined && body !== null;
  if (hasBody && !hasBinaryBody && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const requestInit: RequestInit = {
    ...init,
    headers,
  };

  const tryRequest = async (url: string) => {
    const response = await fetch(url, requestInit);
    const parsedBody = await parseWpResponseBody(response);
    return { response, parsedBody };
  };

  const primaryUrl = buildWpUrl(path);
  let { response, parsedBody } = await tryRequest(primaryUrl);

  if (isHtmlResponse(response, parsedBody)) {
    const fallbackUrl = buildFallbackWpUrl(path);
    if (fallbackUrl) {
      const fallbackAttempt = await tryRequest(fallbackUrl);
      response = fallbackAttempt.response;
      parsedBody = fallbackAttempt.parsedBody;
    }
  }

  if (!response.ok) {
    throw new WpApiError(
      response.status,
      `WordPress request failed (${response.status}) for ${path}.`,
      parsedBody,
    );
  }

  if (typeof parsedBody === "string") {
    throw new WpApiError(
      502,
      "WordPress REST API returned HTML instead of JSON. If /wp-json is not enabled, use plain permalinks with rest_route or fix rewrite rules.",
      {
        path,
        sample: parsedBody.slice(0, 300),
      },
    );
  }

  return parsedBody as T;
};

const extensionFromMime = (mime: string) => {
  const normalized = mime.toLowerCase();
  if (normalized.includes("jpeg") || normalized.includes("jpg")) {
    return "jpg";
  }
  if (normalized.includes("webp")) {
    return "webp";
  }
  if (normalized.includes("gif")) {
    return "gif";
  }
  return "png";
};

const sanitizeFilename = (input: string) =>
  input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

export const uploadFeaturedMedia = async (params: {
  imageBase64: string;
  mimeType: string;
  title: string;
  filenameSuggestion?: string;
  altText?: string;
}) => {
  const filenameInput =
    params.filenameSuggestion?.replace(/\.[a-z0-9]+$/i, "") || params.title;
  const filenameStem = sanitizeFilename(filenameInput) || "featured-image";
  const extension = extensionFromMime(params.mimeType);
  const filename = `${filenameStem}.${extension}`;
  const cleanedBase64 = params.imageBase64.replace(
    /^data:[^;]+;base64,/,
    "",
  );
  const bytes = Buffer.from(cleanedBase64, "base64");

  const headers = new Headers();
  headers.set("Content-Disposition", `attachment; filename="${filename}"`);
  headers.set("Content-Type", params.mimeType);

  const uploaded = await wpRequest<WpMediaResponse>("/wp-json/wp/v2/media", {
    method: "POST",
    headers,
    body: bytes,
  });

  if (params.altText?.trim()) {
    try {
      await wpRequest<Record<string, unknown>>(
        `/wp-json/wp/v2/media/${uploaded.id}`,
        {
          method: "POST",
          body: JSON.stringify({
            alt_text: params.altText.trim(),
          }),
        },
      );
    } catch {
      // Keep upload successful even if alt text update is blocked.
    }
  }

  return uploaded;
};

export const createPost = async (payload: {
  title: string;
  html: string;
  status: "draft" | "publish";
  excerpt: string;
  featuredMediaId?: number;
  categories?: number[];
}) => {
  const body: Record<string, unknown> = {
    title: payload.title,
    content: payload.html,
    excerpt: payload.excerpt,
    status: payload.status,
  };
  if (payload.featuredMediaId) {
    body.featured_media = payload.featuredMediaId;
  }
  if (payload.categories && payload.categories.length > 0) {
    body.categories = payload.categories;
  }

  return wpRequest<WpPostResponse>("/wp-json/wp/v2/posts", {
    method: "POST",
    body: JSON.stringify(body),
  });
};

export const updatePost = async (
  postId: number,
  payload: Record<string, unknown>,
) => {
  return wpRequest<Record<string, unknown>>(`/wp-json/wp/v2/posts/${postId}`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
};

export const getCurrentUser = async () => {
  return wpRequest<Record<string, unknown>>("/wp-json/wp/v2/users/me", {
    method: "GET",
  });
};

export const getSeoDiagnosticPosts = async () => {
  const query =
    "/wp-json/wp/v2/posts?per_page=1&context=edit&_fields=id,title,meta,aioseo_head,aioseo_meta_data";
  return wpRequest<Array<Record<string, unknown>>>(query, { method: "GET" });
};

export const listCategories = async () => {
  const query =
    "/wp-json/wp/v2/categories?per_page=100&orderby=name&order=asc&context=edit&_fields=id,name,slug,count";
  return wpRequest<WpCategory[]>(query, { method: "GET" });
};

export const getCategoryByName = async (name: string) => {
  const query = `/wp-json/wp/v2/categories?search=${encodeURIComponent(name)}&per_page=100&context=edit&_fields=id,name,slug,count`;
  const results = await wpRequest<WpCategory[]>(query, { method: "GET" });
  const needle = name.trim().toLowerCase();
  return (
    results.find((category) => category.name.trim().toLowerCase() === needle) ||
    null
  );
};

export const createCategory = async (name: string) => {
  return wpRequest<WpCategory>("/wp-json/wp/v2/categories", {
    method: "POST",
    body: JSON.stringify({ name: name.trim() }),
  });
};

export const ensureCategory = async (name: string) => {
  const normalized = name.trim();
  if (!normalized) {
    throw new HttpError(400, "Category name cannot be empty.");
  }
  const existing = await getCategoryByName(normalized);
  if (existing) {
    return existing;
  }
  return createCategory(normalized);
};
