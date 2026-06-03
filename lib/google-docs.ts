import { HttpError } from "@/lib/errors";
import { slugifyArticle } from "@/lib/slug";

const GOOGLE_DOCS_BASE_URL = "https://docs.google.com/document/d";

export interface GoogleDocPostDraft {
  documentId: string;
  documentName: string;
  title: string;
  slug: string;
  html: string;
  excerpt: string;
  brief: string;
  categories: string[];
  tags: string[];
  imageUrls: string[];
  images: GoogleDocImage[];
  seoTitle?: string;
  metaDescription?: string;
  focusKeyword?: string;
  canonicalUrl?: string;
  featuredImageUrl?: string;
  imagePrompt?: string;
}

export interface GoogleDocImage {
  url: string;
  altText: string;
  title: string;
}

const extractDocumentId = (input: string) => {
  const trimmed = input.trim();
  const urlMatch = trimmed.match(/\/document\/d\/([a-zA-Z0-9-_]+)/);
  return urlMatch?.[1] || trimmed;
};

const isAccessWallResponse = (response: Response, body: string) =>
  response.url.includes("accounts.google.com") ||
  /ServiceLogin|Sign in - Google Accounts|To continue, sign in/i.test(body);

const throwGoogleDocAccessError = (documentId: string, status?: number) => {
  throw new HttpError(
    403,
    "This Google Doc is not accessible from the link alone. Share it as 'Anyone with the link can view' or use 'File > Share > Publish to web', then try the same document link again.",
    {
      documentId,
      status: status ?? null,
    },
  );
};

const normalizeMetadataKey = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

const allowedMetadataKeys = new Set([
  "title",
  "slug",
  "excerpt",
  "brief",
  "image_prompt",
  "featured_image_prompt",
  "prompt",
  "seo_title",
  "meta_title",
  "meta_description",
  "seo_description",
  "focus_keyword",
  "canonical_url",
  "featured_image_url",
  "image_url",
  "categories",
  "category",
  "tags",
  "tag",
]);

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const stripHtml = (value: string) =>
  value
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const htmlToText = (value: string) =>
  stripHtml(
    value
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|div|h[1-6]|li)>/gi, "\n"),
  );

const decodeHtmlAttribute = (value: string) =>
  value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");

const normalizeOptionalUrl = (value: string) => {
  if (!value.trim()) {
    return undefined;
  }

  try {
    return new URL(value.trim()).toString();
  } catch {
    return undefined;
  }
};

const parseFrontMatter = (markdown: string) => {
  const normalized = markdown.replace(/^\uFEFF/, "");
  if (!normalized.startsWith("---\n")) {
    return null;
  }

  const endIndex = normalized.indexOf("\n---\n", 4);
  if (endIndex === -1) {
    return null;
  }

  const rawMetadata = normalized.slice(4, endIndex);
  const body = normalized.slice(endIndex + 5);
  const metadata: Record<string, string> = {};

  for (const line of rawMetadata.split(/\r?\n/)) {
    const match = line.match(/^([^:]+):\s*(.*)$/);
    if (!match) {
      continue;
    }

    const key = normalizeMetadataKey(match[1]);
    if (!allowedMetadataKeys.has(key)) {
      continue;
    }

    metadata[key] = match[2].trim();
  }

  return { metadata, body };
};

const parseLeadingMetadata = (markdown: string) => {
  const lines = markdown.replace(/^\uFEFF/, "").split(/\r?\n/);
  const metadata: Record<string, string> = {};
  let index = 0;
  let sawMetadata = false;

  while (index < lines.length) {
    const line = lines[index].trim();
    if (!line) {
      if (sawMetadata) {
        index += 1;
        break;
      }
      index += 1;
      continue;
    }

    const match = line.match(/^([^:]{1,60}):\s*(.*)$/);
    if (!match) {
      break;
    }

    const key = normalizeMetadataKey(match[1]);
    if (!allowedMetadataKeys.has(key)) {
      break;
    }

    metadata[key] = match[2].trim();
    sawMetadata = true;
    index += 1;
  }

  return {
    metadata,
    body: lines.slice(index).join("\n"),
  };
};

const pickMetadata = (metadata: Record<string, string>, keys: string[]) => {
  for (const key of keys) {
    const value = metadata[key];
    if (value && value.trim()) {
      return value.trim();
    }
  }
  return "";
};

const applyInlineMarkdown = (value: string) => {
  let text = escapeHtml(value);
  text = text.replace(/!\[([^\]]*)\]\((https?:\/\/[^\s)]+)\)/g, (_all, alt, url) => {
    return `<img src="${url}" alt="${alt}" loading="lazy" decoding="async" />`;
  });
  text = text.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, (_all, label, url) => {
    return `<a href="${url}">${label}</a>`;
  });
  text = text.replace(/`([^`]+)`/g, "<code>$1</code>");
  text = text.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  text = text.replace(/(^|[^*])\*([^*]+)\*(?!\*)/g, "$1<em>$2</em>");
  return text;
};

const markdownToHtml = (markdown: string) => {
  if (/<[a-z][\s\S]*>/i.test(markdown)) {
    return markdown.trim();
  }

  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const blocks: string[] = [];
  let paragraph: string[] = [];
  let listItems: string[] = [];
  let listType: "ul" | "ol" | null = null;

  const flushParagraph = () => {
    if (paragraph.length === 0) {
      return;
    }
    blocks.push(`<p>${applyInlineMarkdown(paragraph.join(" "))}</p>`);
    paragraph = [];
  };

  const flushList = () => {
    if (!listType || listItems.length === 0) {
      return;
    }
    blocks.push(`<${listType}>${listItems.join("")}</${listType}>`);
    listItems = [];
    listType = null;
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (!line) {
      flushParagraph();
      flushList();
      continue;
    }

    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      flushParagraph();
      flushList();
      const level = Math.min(headingMatch[1].length, 6);
      blocks.push(
        `<h${level}>${applyInlineMarkdown(headingMatch[2].trim())}</h${level}>`,
      );
      continue;
    }

    const orderedMatch = line.match(/^\d+\.\s+(.+)$/);
    if (orderedMatch) {
      flushParagraph();
      if (listType && listType !== "ol") {
        flushList();
      }
      listType = "ol";
      listItems.push(`<li>${applyInlineMarkdown(orderedMatch[1].trim())}</li>`);
      continue;
    }

    const unorderedMatch = line.match(/^[-*+]\s+(.+)$/);
    if (unorderedMatch) {
      flushParagraph();
      if (listType && listType !== "ul") {
        flushList();
      }
      listType = "ul";
      listItems.push(`<li>${applyInlineMarkdown(unorderedMatch[1].trim())}</li>`);
      continue;
    }

    const bulletMatch = line.match(/^[•▪◦]\s+(.+)$/);
    if (bulletMatch) {
      flushParagraph();
      if (listType && listType !== "ul") {
        flushList();
      }
      listType = "ul";
      listItems.push(`<li>${applyInlineMarkdown(bulletMatch[1].trim())}</li>`);
      continue;
    }

    if (/^<\/?[a-z][\s\S]*>$/i.test(line)) {
      flushParagraph();
      flushList();
      blocks.push(line);
      continue;
    }

    if (listType) {
      flushList();
    }
    paragraph.push(line);
  }

  flushParagraph();
  flushList();

  return blocks.join("\n");
};

const parseGoogleDocMarkdown = (markdown: string, fallbackTitle: string) => {
  const frontMatter = parseFrontMatter(markdown);
  const metadataSource = frontMatter || parseLeadingMetadata(markdown);
  const metadata = metadataSource.metadata;
  let body = metadataSource.body.trim();

  body = body.replace(/^#{1,6}\s+content\s*$/im, "").trim();

  let title = pickMetadata(metadata, ["title"]);
  if (!title) {
    const firstHeadingMatch = body.match(/^#\s+(.+)$/m);
    if (firstHeadingMatch) {
      title = firstHeadingMatch[1].trim();
      body = body.replace(/^#\s+.+\n*/m, "").trim();
    }
  }

  if (!title) {
    const firstMeaningfulLine = body
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find(Boolean);

    if (firstMeaningfulLine) {
      title = firstMeaningfulLine;
      body = body.replace(new RegExp(`^${firstMeaningfulLine.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*`), "").trim();
    }
  }

  title = title || fallbackTitle;
  const slug = slugifyArticle(pickMetadata(metadata, ["slug"]) || title) || "article";
  const excerpt = pickMetadata(metadata, ["excerpt"]);
  const brief =
    pickMetadata(metadata, [
      "brief",
      "image_prompt",
      "featured_image_prompt",
      "prompt",
    ]) ||
    excerpt ||
    stripHtml(markdownToHtml(body)).slice(0, 240) ||
    title;
  const categories = pickMetadata(metadata, ["categories", "category"])
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  const tags = pickMetadata(metadata, ["tags", "tag"])
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  return {
    title,
    slug,
    html: markdownToHtml(body),
    excerpt,
    brief,
    categories,
    tags,
    seoTitle: pickMetadata(metadata, ["seo_title", "meta_title"]) || undefined,
    metaDescription:
      pickMetadata(metadata, ["meta_description", "seo_description"]) || undefined,
    focusKeyword: pickMetadata(metadata, ["focus_keyword"]) || undefined,
    canonicalUrl: normalizeOptionalUrl(
      pickMetadata(metadata, ["canonical_url"]),
    ),
    featuredImageUrl: normalizeOptionalUrl(
      pickMetadata(metadata, ["featured_image_url", "image_url"]),
    ),
    imagePrompt:
      pickMetadata(metadata, [
        "image_prompt",
        "featured_image_prompt",
        "prompt",
      ]) || undefined,
  };
};

const getHtmlAttribute = (html: string, attribute: string) => {
  const pattern = new RegExp(`\\b${attribute}\\s*=\\s*(["'])(.*?)\\1`, "i");
  const match = html.match(pattern);
  return match ? decodeHtmlAttribute(match[2]).trim() : "";
};

const normalizeHtmlImageUrl = (rawSrc: string, baseUrl: string) => {
  if (!rawSrc || rawSrc.startsWith("data:")) {
    return "";
  }
  try {
    const resolved = new URL(rawSrc, baseUrl).toString();
    return /^https?:\/\//i.test(resolved) ? resolved : "";
  } catch {
    return "";
  }
};

const extractImageItemsFromHtml = (html: string, baseUrl: string) => {
  const images: GoogleDocImage[] = [];
  const seen = new Set<string>();
  const imagePattern = /<img\b[^>]*>/gi;
  let match: RegExpExecArray | null;

  while ((match = imagePattern.exec(html))) {
    const imageTag = match[0];
    const url = normalizeHtmlImageUrl(getHtmlAttribute(imageTag, "src"), baseUrl);
    if (!url || seen.has(url)) {
      continue;
    }
    seen.add(url);
    images.push({
      url,
      altText: getHtmlAttribute(imageTag, "alt"),
      title: getHtmlAttribute(imageTag, "title"),
    });
  }

  return images;
};

const extractBodyHtml = (html: string) => {
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  return (bodyMatch ? bodyMatch[1] : html).trim();
};

const stripGoogleDocChrome = (html: string) =>
  html
    .replace(/<script\b[\s\S]*?<\/script>/gi, "")
    .replace(/<style\b[\s\S]*?<\/style>/gi, "")
    .replace(/<meta\b[^>]*>/gi, "")
    .replace(/<link\b[^>]*>/gi, "");

const stripFrontMatterFromHtml = (html: string) => {
  let output = html.trim();
  output = output.replace(/^\s*<[^>]+>\s*---\s*<\/[^>]+>\s*/i, "");

  let guard = 0;
  while (guard < 40) {
    const blockMatch = output.match(/^\s*<([a-z0-9]+)\b[^>]*>([\s\S]*?)<\/\1>\s*/i);
    if (!blockMatch) {
      break;
    }
    const text = htmlToText(blockMatch[2]);
    if (text === "---") {
      output = output.slice(blockMatch[0].length);
      break;
    }
    const metadataMatch = text.match(/^([^:]{1,60}):\s*(.*)$/);
    if (!metadataMatch || !allowedMetadataKeys.has(normalizeMetadataKey(metadataMatch[1]))) {
      break;
    }
    output = output.slice(blockMatch[0].length);
    guard += 1;
  }

  return output.trim();
};

const normalizeGoogleDocHtml = (html: string) =>
  stripFrontMatterFromHtml(stripGoogleDocChrome(extractBodyHtml(html)))
    .replace(/\sclass="[^"]*"/gi, "")
    .replace(/\sstyle="[^"]*"/gi, "")
    .replace(/\sid="[^"]*"/gi, "")
    .replace(/<span\b[^>]*>([\s\S]*?)<\/span>/gi, "$1")
    .replace(
      /<p>\s*(#{1,3})\s+([\s\S]*?)<\/p>/gi,
      (_all, hashes: string, text: string) =>
        `<h${hashes.length}>${text.trim()}</h${hashes.length}>`,
    )
    .replace(/<p>\s*<\/p>/gi, "")
    .trim();

const hasUsefulGoogleDocHtml = (html: string) =>
  Boolean(htmlToText(html).trim() || /<img\b/i.test(html));

const mergeImageItems = (items: GoogleDocImage[]) => {
  const seen = new Set<string>();
  const merged: GoogleDocImage[] = [];
  for (const item of items) {
    if (!item.url || seen.has(item.url)) {
      continue;
    }
    seen.add(item.url);
    merged.push(item);
  }
  return merged;
};

const fetchGoogleDocHtml = async (documentId: string) => {
  const candidates = [
    `${GOOGLE_DOCS_BASE_URL}/${documentId}/mobilebasic`,
    `${GOOGLE_DOCS_BASE_URL}/${documentId}/export?format=html`,
  ];

  for (const url of candidates) {
    const response = await fetch(url, { redirect: "follow" });
    const body = await response.text();
    if (isAccessWallResponse(response, body)) {
      continue;
    }
    if (!response.ok) {
      continue;
    }

    const contentType = response.headers.get("content-type")?.toLowerCase() || "";
    if (contentType.includes("zip")) {
      continue;
    }

    return {
      html: body,
      url: response.url || url,
    };
  }

  return null;
};

const buildImageFigure = (url: string, title: string) =>
  `<figure class="wp-block-image size-large"><img src="${escapeHtml(url)}" alt="${escapeHtml(
    title,
  )}" loading="lazy" decoding="async" /></figure>`;

const appendImagesIfMissing = (html: string, imageUrls: string[], title: string) => {
  if (imageUrls.length === 0 || /<img\b/i.test(html)) {
    return html;
  }
  return `${html}\n${imageUrls.map((url) => buildImageFigure(url, title)).join("\n")}`;
};

export const readGoogleDocPost = async (input: { document: string }) => {
  const documentId = extractDocumentId(input.document);
  const exportUrl = `${GOOGLE_DOCS_BASE_URL}/${documentId}/export?format=txt`;
  const exportResponse = await fetch(exportUrl, {
    redirect: "follow",
  });
  const markdown = await exportResponse.text();

  if (isAccessWallResponse(exportResponse, markdown)) {
    throwGoogleDocAccessError(documentId, exportResponse.status);
  }

  if (!exportResponse.ok) {
    if (exportResponse.status === 401 || exportResponse.status === 403) {
      throwGoogleDocAccessError(documentId, exportResponse.status);
    }

    throw new HttpError(502, "Failed to export Google Doc content.", {
      documentId,
      status: exportResponse.status,
      body: markdown.slice(0, 500),
    });
  }

  if (!markdown.trim()) {
    throw new HttpError(400, "Google Doc is empty or could not be exported.", {
      documentId,
    });
  }

  const parsed = parseGoogleDocMarkdown(markdown, "Untitled");
  const htmlExport = await fetchGoogleDocHtml(documentId);
  const htmlFromDoc = htmlExport ? normalizeGoogleDocHtml(htmlExport.html) : "";
  const htmlImages = htmlExport
    ? extractImageItemsFromHtml(htmlExport.html, htmlExport.url)
    : [];
  const featuredImage = parsed.featuredImageUrl
    ? { url: parsed.featuredImageUrl, altText: "", title: "" }
    : htmlImages[0];
  const images = mergeImageItems([
    ...(featuredImage ? [featuredImage] : []),
    ...htmlImages,
  ]);
  const imageUrls = images.map((image) => image.url);
  const featuredImageUrl = featuredImage?.url;
  const baseHtml = hasUsefulGoogleDocHtml(htmlFromDoc) ? htmlFromDoc : parsed.html;
  const html = appendImagesIfMissing(baseHtml, imageUrls, parsed.title);

  if (!parsed.title.trim()) {
    throw new HttpError(400, "Google Doc is missing a usable title.");
  }
  if (!html.trim()) {
    throw new HttpError(400, "Google Doc is missing usable content.");
  }

  return {
    documentId,
    documentName: parsed.title,
    ...parsed,
    html,
    imageUrls,
    images,
    featuredImageUrl,
  } satisfies GoogleDocPostDraft;
};
