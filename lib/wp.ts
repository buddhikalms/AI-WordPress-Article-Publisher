import { HttpError } from "@/lib/errors";

export class WpApiError extends HttpError {
  constructor(status: number, message: string, details?: unknown) {
    super(status, message, details);
    this.name = "WpApiError";
  }
}

export interface WpConfig {
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

export interface WpTag {
  id: number;
  name: string;
  slug: string;
  count?: number;
}

const getWpConfig = (override?: WpConfig): WpConfig => {
  if (override) {
    if (!override.baseUrl.trim() || !override.username.trim() || !override.appPassword.trim()) {
      throw new HttpError(400, "WordPress credentials are incomplete for this account.");
    }

    return {
      baseUrl: override.baseUrl.trim().replace(/\/+$/, ""),
      username: override.username.trim(),
      appPassword: override.appPassword.trim(),
    };
  }

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

const buildWpUrl = (path: string, config?: WpConfig) => {
  const { baseUrl } = getWpConfig(config);
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

const buildFallbackWpUrl = (path: string, config?: WpConfig) => {
  const { baseUrl } = getWpConfig(config);
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

const buildAuthHeader = (config?: WpConfig) => {
  const { username, appPassword } = getWpConfig(config);
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

const getWpErrorMessage = (status: number, path: string) => {
  if (status === 401) {
    return `WordPress rejected the saved credentials for ${path}. Check the selected site's WordPress username and application password.`;
  }
  if (status === 403 && path.includes("/wp/v2/media")) {
    return "WordPress refused the media upload. Check that the selected site user can upload files.";
  }
  if (status === 403) {
    return `WordPress refused permission for ${path}. Check the selected site's user role and REST API permissions.`;
  }
  return `WordPress request failed (${status}) for ${path}.`;
};

const wpRequest = async <T>(
  path: string,
  init: RequestInit = {},
  config?: WpConfig,
): Promise<T> => {
  const headers = new Headers(init.headers);
  headers.set("Authorization", buildAuthHeader(config));

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

  const primaryUrl = buildWpUrl(path, config);
  let { response, parsedBody } = await tryRequest(primaryUrl);

  if (isHtmlResponse(response, parsedBody)) {
    const fallbackUrl = buildFallbackWpUrl(path, config);
    if (fallbackUrl) {
      const fallbackAttempt = await tryRequest(fallbackUrl);
      response = fallbackAttempt.response;
      parsedBody = fallbackAttempt.parsedBody;
    }
  }

  if (!response.ok) {
    throw new WpApiError(
      response.status,
      getWpErrorMessage(response.status, path),
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
}, config?: WpConfig) => {
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
  }, config);

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
        config,
      );
    } catch {
      // Keep upload successful even if alt text update is blocked.
    }
  }

  return uploaded;
};

export const createPost = async (payload: {
  title: string;
  slug?: string;
  html: string;
  status: "draft" | "publish" | "future";
  excerpt: string;
  date?: string;
  featuredMediaId?: number;
  categories?: number[];
  tags?: number[];
}, config?: WpConfig) => {
  const body: Record<string, unknown> = {
    title: payload.title,
    content: payload.html,
    excerpt: payload.excerpt,
    status: payload.status,
  };
  if (payload.slug?.trim()) {
    body.slug = payload.slug.trim();
  }
  if (payload.featuredMediaId) {
    body.featured_media = payload.featuredMediaId;
  }
  if (payload.date) {
    body.date = payload.date;
  }
  if (payload.categories && payload.categories.length > 0) {
    body.categories = payload.categories;
  }
  if (payload.tags && payload.tags.length > 0) {
    body.tags = payload.tags;
  }

  return wpRequest<WpPostResponse>("/wp-json/wp/v2/posts", {
    method: "POST",
    body: JSON.stringify(body),
  }, config);
};

export const updatePost = async (
  postId: number,
  payload: Record<string, unknown>,
  config?: WpConfig,
) => {
  return wpRequest<Record<string, unknown>>(`/wp-json/wp/v2/posts/${postId}`, {
    method: "POST",
    body: JSON.stringify(payload),
  }, config);
};

export const getCurrentUser = async (config?: WpConfig) => {
  return wpRequest<Record<string, unknown>>("/wp-json/wp/v2/users/me", {
    method: "GET",
  }, config);
};

export const getSeoDiagnosticPosts = async (config?: WpConfig) => {
  const query =
    "/wp-json/wp/v2/posts?per_page=1&context=edit&_fields=id,title,meta,aioseo_head,aioseo_meta_data";
  return wpRequest<Array<Record<string, unknown>>>(query, { method: "GET" }, config);
};

export const listCategories = async (config?: WpConfig) => {
  const query =
    "/wp-json/wp/v2/categories?per_page=100&orderby=name&order=asc&context=view&_fields=id,name,slug,count";
  return wpRequest<WpCategory[]>(query, { method: "GET" }, config);
};

export const getCategoryByName = async (name: string, config?: WpConfig) => {
  const query = `/wp-json/wp/v2/categories?search=${encodeURIComponent(name)}&per_page=100&context=view&_fields=id,name,slug,count`;
  const results = await wpRequest<WpCategory[]>(query, { method: "GET" }, config);
  const needle = name.trim().toLowerCase();
  return (
    results.find((category) => category.name.trim().toLowerCase() === needle) ||
    null
  );
};

export const createCategory = async (name: string, config?: WpConfig) => {
  return wpRequest<WpCategory>("/wp-json/wp/v2/categories", {
    method: "POST",
    body: JSON.stringify({ name: name.trim() }),
  }, config);
};

export const ensureCategory = async (name: string, config?: WpConfig) => {
  const normalized = name.trim();
  if (!normalized) {
    throw new HttpError(400, "Category name cannot be empty.");
  }
  const existing = await getCategoryByName(normalized, config);
  if (existing) {
    return existing;
  }
  return createCategory(normalized, config);
};

export const listTags = async (config?: WpConfig) => {
  const query =
    "/wp-json/wp/v2/tags?per_page=100&orderby=name&order=asc&context=view&_fields=id,name,slug,count";
  return wpRequest<WpTag[]>(query, { method: "GET" }, config);
};

export const getTagByName = async (name: string, config?: WpConfig) => {
  const query = `/wp-json/wp/v2/tags?search=${encodeURIComponent(name)}&per_page=100&context=view&_fields=id,name,slug,count`;
  const results = await wpRequest<WpTag[]>(query, { method: "GET" }, config);
  const needle = name.trim().toLowerCase();
  return results.find((tag) => tag.name.trim().toLowerCase() === needle) || null;
};

export const createTag = async (name: string, config?: WpConfig) => {
  return wpRequest<WpTag>("/wp-json/wp/v2/tags", {
    method: "POST",
    body: JSON.stringify({ name: name.trim() }),
  }, config);
};

export const ensureTag = async (name: string, config?: WpConfig) => {
  const normalized = name.trim();
  if (!normalized) {
    throw new HttpError(400, "Tag name cannot be empty.");
  }
  const existing = await getTagByName(normalized, config);
  if (existing) {
    return existing;
  }
  return createTag(normalized, config);
};
