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

const normalizeWpBaseUrl = (value: string) => {
  const trimmed = value.trim().replace(/\/+$/, "");

  try {
    const url = new URL(trimmed);
    url.pathname = url.pathname
      .replace(/\/wp-json(?:\/.*)?$/i, "")
      .replace(/\/index\.php$/i, "")
      .replace(/\/+$/, "");
    url.search = "";
    url.hash = "";
    return url.toString().replace(/\/+$/, "");
  } catch {
    return trimmed
      .replace(/\/wp-json(?:\/.*)?$/i, "")
      .replace(/\/index\.php$/i, "")
      .replace(/\/+$/, "");
  }
};

const getWpConfig = (override?: WpConfig): WpConfig => {
  if (override) {
    if (!override.baseUrl.trim() || !override.username.trim() || !override.appPassword.trim()) {
      throw new HttpError(400, "WordPress credentials are incomplete for this account.");
    }

    return {
      baseUrl: normalizeWpBaseUrl(override.baseUrl),
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

  return { baseUrl: normalizeWpBaseUrl(baseUrl), username, appPassword };
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

const buildRestRouteFallbackUrl = (
  baseUrl: string,
  restRoute: string,
  queryString: string,
  includeIndex: boolean,
) => {
  const url = new URL(includeIndex ? `${baseUrl}/index.php` : `${baseUrl}/`);
  url.searchParams.set("rest_route", restRoute.startsWith("/") ? restRoute : `/${restRoute}`);

  if (queryString) {
    const params = new URLSearchParams(queryString);
    params.forEach((value, key) => {
      url.searchParams.append(key, value);
    });
  }

  return url.toString();
};

const buildFallbackWpUrls = (path: string, config?: WpConfig) => {
  const { baseUrl } = getWpConfig(config);
  if (/^https?:\/\//i.test(path)) {
    return [];
  }
  const { pathname, queryString } = splitPathAndQuery(path);
  if (!pathname.startsWith("/wp-json/")) {
    return [];
  }

  const restRoute = pathname.replace(/^\/wp-json/, "") || "/";
  return Array.from(
    new Set([
      buildRestRouteFallbackUrl(baseUrl, restRoute, queryString, false),
      buildRestRouteFallbackUrl(baseUrl, restRoute, queryString, true),
    ]),
  );
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
  if (typeof parsedBody !== "string") {
    return false;
  }
  const sample = parsedBody.trimStart().slice(0, 80).toLowerCase();
  return sample.startsWith("<!doctype html") || sample.startsWith("<html") || sample.includes("<head");
};

const buildHttpsUpgradeUrl = (url: string) => {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:") {
      return null;
    }
    if (["localhost", "127.0.0.1", "::1"].includes(parsed.hostname)) {
      return null;
    }
    parsed.protocol = "https:";
    return parsed.toString();
  } catch {
    return null;
  }
};

const getWpResponseMessage = (details: unknown) => {
  if (!details || typeof details !== "object") {
    return "";
  }

  const body = details as { code?: unknown; message?: unknown };
  const message = typeof body.message === "string" ? body.message.trim() : "";
  const code = typeof body.code === "string" ? body.code.trim() : "";
  if (message && code) {
    return `${message} (${code})`;
  }
  return message || code;
};

const getWpErrorMessage = (status: number, path: string, details?: unknown) => {
  const responseMessage = getWpResponseMessage(details);
  if ((status === 401 || status === 403) && path.includes("/wp/v2/media")) {
    return responseMessage
      ? `WordPress refused the media upload: ${responseMessage}`
      : "WordPress refused the media upload. The saved login can be valid while the selected WordPress user, REST rules, or security plugin blocks uploading files.";
  }
  if (status === 401) {
    return responseMessage
      ? `WordPress rejected authentication for ${path}: ${responseMessage}`
      : `WordPress rejected authentication for ${path}. Check the selected site's WordPress URL, username, and application password.`;
  }
  if (status === 403) {
    return responseMessage
      ? `WordPress refused permission for ${path}: ${responseMessage}`
      : `WordPress refused permission for ${path}. Check the selected site's user role and REST API permissions.`;
  }
  return responseMessage
    ? `WordPress request failed (${status}) for ${path}: ${responseMessage}`
    : `WordPress request failed (${status}) for ${path}.`;
};

const wpRequest = async <T>(
  path: string,
  init: RequestInit = {},
  config?: WpConfig,
): Promise<T> => {
  const headers = new Headers(init.headers);
  headers.set("Authorization", buildAuthHeader(config));
  if (!headers.has("Accept")) {
    headers.set("Accept", "application/json");
  }

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

  if (response.status === 401) {
    const httpsUrl = buildHttpsUpgradeUrl(primaryUrl);
    if (httpsUrl && httpsUrl !== primaryUrl) {
      try {
        const httpsAttempt = await tryRequest(httpsUrl);
        if (httpsAttempt.response.status !== 401) {
          response = httpsAttempt.response;
          parsedBody = httpsAttempt.parsedBody;
        }
      } catch {
        // Keep the original WordPress response when the HTTPS retry cannot connect.
      }
    }
  }

  if (isHtmlResponse(response, parsedBody)) {
    const fallbackUrls = buildFallbackWpUrls(path, config);
    for (const fallbackUrl of fallbackUrls) {
      const fallbackAttempt = await tryRequest(fallbackUrl);
      response = fallbackAttempt.response;
      parsedBody = fallbackAttempt.parsedBody;
      if (!isHtmlResponse(response, parsedBody)) {
        break;
      }
    }
  }

  if (isHtmlResponse(response, parsedBody)) {
    throw new WpApiError(
      502,
      "WordPress returned HTML for the REST API request. The app tried both /wp-json and ?rest_route= fallbacks, so check the saved site URL, REST API availability, rewrite rules, and any firewall or security plugin blocking REST requests.",
      {
        path,
        status: response.status,
        sample: typeof parsedBody === "string" ? parsedBody.slice(0, 300) : null,
      },
    );
  }

  if (!response.ok) {
    throw new WpApiError(
      response.status,
      getWpErrorMessage(response.status, path, parsedBody),
      parsedBody,
    );
  }

  if (typeof parsedBody === "string") {
    throw new WpApiError(
      502,
      "WordPress REST API returned text instead of JSON. Check the saved site URL, REST API availability, rewrite rules, and any firewall or security plugin blocking REST requests.",
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
  caption?: string;
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

  const mediaUpdate: Record<string, unknown> = {};
  if (params.title.trim()) {
    mediaUpdate.title = params.title.trim();
  }
  if (params.altText?.trim()) {
    mediaUpdate.alt_text = params.altText.trim();
  }
  if (params.caption?.trim()) {
    mediaUpdate.caption = params.caption.trim();
  }

  if (Object.keys(mediaUpdate).length > 0) {
    try {
      await wpRequest<Record<string, unknown>>(
        `/wp-json/wp/v2/media/${uploaded.id}`,
        {
          method: "POST",
          body: JSON.stringify(mediaUpdate),
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

export interface WpPostSummary {
  id: number;
  link: string;
  status: string;
  title: string;
  excerpt: string;
  slug: string;
  date: string;
  modified: string;
  author: number;
  featuredMediaId: number;
  categories: number[];
  tags: number[];
}

export interface WpPostDetail extends WpPostSummary {
  content: string;
}

interface WpRawPostFields {
  id: number;
  link: string;
  status: string;
  slug: string;
  date: string;
  modified: string;
  author: number;
  featured_media?: number;
  categories?: number[];
  tags?: number[];
  title?: { rendered?: string } | string;
  excerpt?: { rendered?: string } | string;
  content?: { rendered?: string } | string;
}

const renderedField = (value: { rendered?: string } | string | undefined) => {
  if (typeof value === "string") {
    return value;
  }
  return value?.rendered ?? "";
};

const POST_SUMMARY_FIELDS =
  "id,link,status,title,excerpt,slug,date,modified,author,featured_media,categories,tags";

const mapWpPostSummary = (raw: WpRawPostFields): WpPostSummary => ({
  id: raw.id,
  link: raw.link,
  status: raw.status,
  title: renderedField(raw.title),
  excerpt: renderedField(raw.excerpt),
  slug: raw.slug,
  date: raw.date,
  modified: raw.modified,
  author: raw.author,
  featuredMediaId: raw.featured_media || 0,
  categories: raw.categories || [],
  tags: raw.tags || [],
});

export const listPosts = async (
  params: {
    status?: string[];
    search?: string;
    perPage?: number;
    page?: number;
  } = {},
  config?: WpConfig,
): Promise<WpPostSummary[]> => {
  const query = new URLSearchParams();
  query.set("per_page", String(Math.min(Math.max(params.perPage || 10, 1), 50)));
  query.set("page", String(Math.max(params.page || 1, 1)));
  query.set("orderby", "date");
  query.set("order", "desc");
  query.set("_fields", POST_SUMMARY_FIELDS);
  if (params.status && params.status.length > 0) {
    query.set("status", params.status.join(","));
  }
  if (params.search?.trim()) {
    query.set("search", params.search.trim());
  }

  const raw = await wpRequest<WpRawPostFields[]>(
    `/wp-json/wp/v2/posts?${query.toString()}`,
    { method: "GET" },
    config,
  );
  return raw.map(mapWpPostSummary);
};

export const searchPosts = async (
  query: string,
  options: { status?: string[]; limit?: number } = {},
  config?: WpConfig,
) =>
  listPosts(
    {
      search: query,
      status: options.status,
      perPage: options.limit,
    },
    config,
  );

export const getPost = async (
  postId: number,
  config?: WpConfig,
): Promise<WpPostDetail> => {
  const raw = await wpRequest<WpRawPostFields>(
    `/wp-json/wp/v2/posts/${postId}?_fields=${POST_SUMMARY_FIELDS},content`,
    { method: "GET" },
    config,
  );
  return {
    ...mapWpPostSummary(raw),
    content: renderedField(raw.content),
  };
};

export const trashPost = async (postId: number, config?: WpConfig) =>
  wpRequest<Record<string, unknown>>(
    `/wp-json/wp/v2/posts/${postId}`,
    { method: "DELETE" },
    config,
  );

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


