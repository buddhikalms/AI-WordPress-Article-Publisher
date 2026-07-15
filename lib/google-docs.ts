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
  caption: string;
  imageBase64?: string;
  mimeType?: string;
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
  "url",
  "permalink",
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
  "featured_image",
  "image_url",
  "categories",
  "category",
  "tags",
  "tag",
]);

const imageMetadataKeys = new Set(["title", "alt", "alt_text", "caption"]);
type ImageMetadataKey = "title" | "alt" | "caption";

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

const slugifyMetadataValue = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }

  try {
    const parsed = new URL(trimmed);
    const pathParts = parsed.pathname.split("/").filter(Boolean);
    return slugifyArticle(pathParts.at(-1) || trimmed);
  } catch {
    const pathParts = trimmed.replace(/^\/+|\/+$/g, "").split("/").filter(Boolean);
    return slugifyArticle(pathParts.at(-1) || trimmed);
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
  const slug = slugifyMetadataValue(pickMetadata(metadata, ["slug", "url", "permalink"]) || title) || "article";
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
      pickMetadata(metadata, ["featured_image_url", "featured_image", "image_url"]),
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

const pickHtmlAttribute = (html: string, attributes: string[]) => {
  for (const attribute of attributes) {
    const value = getHtmlAttribute(html, attribute);
    if (value) {
      return value;
    }
  }
  return "";
};

const extractImageMetadataLine = (html: string) => {
  const text = htmlToText(html);
  const match = text.match(/^([^:]{1,40}):\s*(.+)$/);
  if (!match) {
    return null;
  }

  const key = normalizeMetadataKey(match[1]);
  if (!imageMetadataKeys.has(key)) {
    return null;
  }

  return {
    key: (key === "alt_text" ? "alt" : key) as ImageMetadataKey,
    value: match[2].trim(),
  };
};

const setGenericHtmlAttribute = (tag: string, attribute: string, value: string) => {
  const escaped = escapeHtml(value);
  const pattern = new RegExp(`\\s*\\b${attribute}\\s*=\\s*(["'])(.*?)\\1`, "i");
  const withoutAttribute = tag.replace(pattern, "");
  return withoutAttribute.replace(/\s*\/?>$/, ` ${attribute}="${escaped}" />`);
};

const applyMetadataToImageBlock = (
  imageBlock: string,
  metadata: { title?: string; alt?: string; caption?: string },
) => {
  const updated = imageBlock.replace(/<img\b[^>]*>/i, (imageTag) => {
    let image = imageTag;
    if (metadata.alt) {
      image = setGenericHtmlAttribute(image, "alt", metadata.alt);
    }
    if (metadata.title) {
      image = setGenericHtmlAttribute(image, "title", metadata.title);
    }
    if (metadata.caption) {
      image = setGenericHtmlAttribute(image, "data-caption", metadata.caption);
    }
    return image;
  });

  if (!metadata.caption || /<figcaption\b/i.test(updated)) {
    return updated;
  }

  const caption = `<figcaption>${escapeHtml(metadata.caption)}</figcaption>`;
  if (/^<figure\b/i.test(updated)) {
    return updated.replace(/<\/figure>\s*$/i, `${caption}</figure>`);
  }
  return `<figure class="wp-block-image">${updated}${caption}</figure>`;
};

const applyGoogleDocImageMetadataBlocks = (html: string) => {
  const blockPattern = /<(p|div|figure)\b[^>]*>[\s\S]*?<\/\1>/gi;
  const parts: string[] = [];
  let cursor = 0;
  let match: RegExpExecArray | null;
  let leadingMetadata: { title?: string; alt?: string; caption?: string } = {};
  let leadingMetadataBlocks: string[] = [];
  let pendingImageBlock = "";
  let trailingMetadata: { title?: string; alt?: string; caption?: string } = {};

  const flushLeadingMetadata = () => {
    if (leadingMetadataBlocks.length > 0) {
      parts.push(leadingMetadataBlocks.join(""));
      leadingMetadataBlocks = [];
    }
    leadingMetadata = {};
  };

  const flushPendingImage = () => {
    if (!pendingImageBlock) {
      return;
    }

    parts.push(applyMetadataToImageBlock(pendingImageBlock, trailingMetadata));
    pendingImageBlock = "";
    trailingMetadata = {};
  };

  while ((match = blockPattern.exec(html))) {
    const before = html.slice(cursor, match.index);
    if (before.trim()) {
      flushLeadingMetadata();
      flushPendingImage();
    }
    parts.push(before);

    const block = match[0];
    const metadataLine = extractImageMetadataLine(block);
    if (metadataLine) {
      if (pendingImageBlock) {
        trailingMetadata[metadataLine.key] = metadataLine.value;
      } else {
        leadingMetadata[metadataLine.key] = metadataLine.value;
        leadingMetadataBlocks.push(block);
      }
      cursor = blockPattern.lastIndex;
      continue;
    }

    if (/<img\b/i.test(block)) {
      flushPendingImage();
      if (Object.keys(leadingMetadata).length > 0) {
        leadingMetadataBlocks = [];
        parts.push(applyMetadataToImageBlock(block, leadingMetadata));
        leadingMetadata = {};
      } else {
        pendingImageBlock = block;
      }
      cursor = blockPattern.lastIndex;
      continue;
    }

    flushLeadingMetadata();
    flushPendingImage();
    parts.push(block);
    cursor = blockPattern.lastIndex;
  }

  const rest = html.slice(cursor);
  if (rest.trim()) {
    flushLeadingMetadata();
    flushPendingImage();
  }
  flushLeadingMetadata();
  flushPendingImage();
  parts.push(rest);

  return parts.join("");
};

const normalizeHtmlImageUrl = (rawSrc: string, baseUrl: string) => {
  if (!rawSrc || parseInlineBase64ImageSource(rawSrc)) {
    return "";
  }
  try {
    const resolved = new URL(rawSrc, baseUrl).toString();
    return /^https?:\/\//i.test(resolved) ? resolved : "";
  } catch {
    return "";
  }
};

const parseInlineBase64ImageSource = (src: string) => {
  const match = src.trim().match(/^(?:data:)?(image\/[a-z0-9.+-]+);base64,([\s\S]+)$/i);
  if (!match) {
    return null;
  }

  const imageBase64 = match[2].replace(/\s+/g, "");
  if (!imageBase64) {
    return null;
  }

  return {
    mimeType: match[1].toLowerCase(),
    imageBase64,
  };
};

const extractImageItemsFromHtml = (html: string, baseUrl: string) => {
  const images: GoogleDocImage[] = [];
  const seen = new Set<string>();
  const imagePattern = /<img\b[^>]*>/gi;
  let match: RegExpExecArray | null;

  while ((match = imagePattern.exec(html))) {
    const imageTag = match[0];
    const blockStart = html.lastIndexOf("<", match.index - 1);
    const blockEnd = html.indexOf(">", imagePattern.lastIndex);
    const nearbyHtml =
      blockStart >= 0 && blockEnd >= imagePattern.lastIndex
        ? html.slice(blockStart, blockEnd + 1)
        : imageTag;
    const altText =
      pickHtmlAttribute(imageTag, ["alt", "aria-label", "data-alt"]) ||
      pickHtmlAttribute(nearbyHtml, ["alt", "aria-label", "data-alt"]);
    const title =
      pickHtmlAttribute(imageTag, ["title", "data-title"]) ||
      pickHtmlAttribute(nearbyHtml, ["title", "data-title"]);
    const caption =
      pickHtmlAttribute(imageTag, ["data-caption"]) ||
      pickHtmlAttribute(nearbyHtml, ["data-caption"]);
    const rawSrc = getHtmlAttribute(imageTag, "src");
    const inlineImage = parseInlineBase64ImageSource(rawSrc);
    if (inlineImage) {
      const key = rawSrc.trim();
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      images.push({
        url: key,
        altText,
        title,
        caption,
        imageBase64: inlineImage.imageBase64,
        mimeType: inlineImage.mimeType,
      });
      continue;
    }

    const url = normalizeHtmlImageUrl(rawSrc, baseUrl);
    if (!url || seen.has(url)) {
      continue;
    }
    seen.add(url);
    images.push({
      url,
      altText,
      title,
      caption,
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

const parseGoogleDocClassStyles = (html: string) => {
  const styles = new Map<string, string>();
  const styleBlockPattern = /<style\b[^>]*>([\s\S]*?)<\/style>/gi;
  let styleBlockMatch: RegExpExecArray | null;

  while ((styleBlockMatch = styleBlockPattern.exec(html))) {
    const css = styleBlockMatch[1];
    const classRulePattern = /([^{}]+)\{([^{}]*)\}/g;
    let classRuleMatch: RegExpExecArray | null;
    while ((classRuleMatch = classRulePattern.exec(css))) {
      const declarations = classRuleMatch[2].trim().replace(/;+$/g, "");
      if (!declarations) {
        continue;
      }
      const selector = classRuleMatch[1];
      const classNames = selector.match(/\.([a-zA-Z0-9_-]+)/g) || [];
      for (const classSelector of classNames) {
        const className = classSelector.slice(1);
        const existing = styles.get(className);
        styles.set(className, existing ? `${existing}; ${declarations}` : declarations);
      }
    }
  }

  return styles;
};

const mergeStyleAttributes = (existingStyle: string, classStyle: string) => {
  const existing = existingStyle.trim().replace(/;+$/g, "");
  const fromClass = classStyle.trim().replace(/;+$/g, "");
  if (!existing) {
    return fromClass;
  }
  if (!fromClass) {
    return existing;
  }
  return `${fromClass}; ${existing}`;
};

const inlineGoogleDocClassStyles = (bodyHtml: string, sourceHtml: string) => {
  const classStyles = parseGoogleDocClassStyles(sourceHtml);
  if (classStyles.size === 0) {
    return bodyHtml;
  }

  return bodyHtml.replace(/<([a-z][a-z0-9]*)\b([^>]*)>/gi, (tag, name: string, attrs: string) => {
    if (tag.startsWith("</")) {
      return tag;
    }

    const classValue = getHtmlAttribute(tag, "class");
    if (!classValue) {
      return tag;
    }

    const mergedClassStyle = classValue
      .split(/\s+/)
      .map((className) => classStyles.get(className))
      .filter((style): style is string => Boolean(style))
      .join("; ");
    if (!mergedClassStyle) {
      return tag;
    }

    const existingStyle = getHtmlAttribute(tag, "style");
    const mergedStyle = mergeStyleAttributes(existingStyle, mergedClassStyle);
    if (/\bstyle\s*=/.test(attrs)) {
      return tag.replace(/\bstyle\s*=\s*(["'])(.*?)\1/i, `style="${escapeHtml(mergedStyle)}"`);
    }
    return `<${name}${attrs} style="${escapeHtml(mergedStyle)}">`;
  });
};

const convertInlineStyledHeadings = (html: string) =>
  html.replace(/<p\b([^>]*)>([\s\S]*?)<\/p>/gi, (all, attrs: string, inner: string) => {
    const text = htmlToText(inner);
    const markdownHeading = text.match(/^(#{1,3})\s+(.+)$/);
    if (markdownHeading) {
      const level = markdownHeading[1].length;
      return `<h${level}>${inner.replace(/^(\s*<[^>]+>)*\s*#{1,3}\s*/i, "").trim()}</h${level}>`;
    }

    const styleText = `${attrs} ${inner}`;
    const fontSizeMatch = styleText.match(/font-size\s*:\s*([0-9.]+)\s*(pt|px)/i);
    if (!fontSizeMatch) {
      return all;
    }

    const rawSize = Number(fontSizeMatch[1]);
    const sizePx = fontSizeMatch[2].toLowerCase() === "pt" ? rawSize * 1.333 : rawSize;
    const isBold = /font-weight\s*:\s*(bold|[6-9]00)|<b\b|<strong\b/i.test(styleText);
    if (sizePx >= 24) {
      return `<h1>${inner.trim()}</h1>`;
    }
    if (sizePx >= 19) {
      return `<h2>${inner.trim()}</h2>`;
    }
    if (sizePx >= 17.5 || (sizePx >= 16 && isBold)) {
      return `<h3>${inner.trim()}</h3>`;
    }
    return all;
  });

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

const removeGoogleDocMetadataBlocks = (html: string) =>
  html.replace(/<p\b[^>]*>([\s\S]*?)<\/p>/gi, (all, inner: string) => {
    const text = htmlToText(inner);
    const metadataMatch = text.match(/^([^:]{1,60}):\s*(.*)$/);
    if (!metadataMatch) {
      return all;
    }
    return allowedMetadataKeys.has(normalizeMetadataKey(metadataMatch[1])) ? "" : all;
  });

const absolutizeImageSources = (html: string, baseUrl: string) =>
  html.replace(/<img\b[^>]*>/gi, (imageTag) => {
    const src = getHtmlAttribute(imageTag, "src");
    const absoluteSrc = normalizeHtmlImageUrl(src, baseUrl);
    if (!absoluteSrc) {
      return imageTag;
    }
    if (/\bsrc\s*=/.test(imageTag)) {
      return imageTag.replace(/\bsrc\s*=\s*(["'])(.*?)\1/i, `src="${absoluteSrc}"`);
    }
    return imageTag.replace(/\s*\/?>$/, ` src="${absoluteSrc}" />`);
  });

const unwrapGoogleRedirectUrl = (url: string) => {
  const trimmed = decodeHtmlAttribute(url).trim();
  try {
    const parsed = new URL(trimmed);
    if (!/(^|\.)google\.[a-z.]+$/i.test(parsed.hostname) || parsed.pathname !== "/url") {
      return trimmed;
    }
    return parsed.searchParams.get("q") || parsed.searchParams.get("url") || trimmed;
  } catch {
    return trimmed;
  }
};

const setHtmlAttribute = (tag: string, attribute: string, value: string) => {
  const escaped = escapeHtml(value);
  const pattern = new RegExp(`\\s*\\b${attribute}\\s*=\\s*(["'])(.*?)\\1`, "i");
  const withoutAttribute = tag.replace(pattern, "");
  return withoutAttribute.replace(/>$/, ` ${attribute}="${escaped}">`);
};

const normalizeGoogleDocLinks = (html: string, baseUrl: string) =>
  html.replace(/<a\b[^>]*>/gi, (anchorTag) => {
    const rawHref = getHtmlAttribute(anchorTag, "href");
    if (!rawHref) {
      return anchorTag;
    }

    let href = unwrapGoogleRedirectUrl(rawHref);
    try {
      if (!href.startsWith("#")) {
        href = new URL(href, baseUrl).toString();
      }
    } catch {
      return anchorTag;
    }

    let updated = anchorTag.replace(/\bhref\s*=\s*(["'])(.*?)\1/i, `href="${escapeHtml(href)}"`);
    if (!updated.includes(`href="${escapeHtml(href)}"`)) {
      updated = updated.replace(/>$/, ` href="${escapeHtml(href)}">`);
    }
    if (!href.startsWith("#")) {
      updated = setHtmlAttribute(updated, "target", "_blank");
      updated = setHtmlAttribute(updated, "rel", "noopener noreferrer");
    }
    return updated;
  });

const extractAlignmentFromClass = (classValue: string) => {
  const match = classValue.match(/(?:^|\s)align(left|right|center)(?:\s|$)/i);
  return match?.[1]?.toLowerCase() || "";
};

const setHtmlClass = (tag: string, className: string) => {
  const cleanClass = className.replace(/[^a-z0-9_-]/gi, "");
  if (!cleanClass) {
    return tag;
  }

  const existing = getHtmlAttribute(tag, "class");
  const classes = Array.from(new Set([...existing.split(/\s+/).filter(Boolean), cleanClass]));
  if (/\bclass\s*=/.test(tag)) {
    return tag.replace(/\bclass\s*=\s*(["'])(.*?)\1/i, `class="${escapeHtml(classes.join(" "))}"`);
  }
  return tag.replace(/\s*\/?>$/, ` class="${escapeHtml(classes.join(" "))}" />`);
};

const detectGoogleDocBlockAlignment = (html: string) => {
  const classAlignment = extractAlignmentFromClass(getHtmlAttribute(html, "class"));
  if (classAlignment) {
    return classAlignment;
  }

  const blockStyle = getHtmlAttribute(html, "style");
  const floatMatch = blockStyle.match(/float\s*:\s*(left|right)/i);
  if (floatMatch) {
    return floatMatch[1].toLowerCase();
  }
  const textAlignMatch = blockStyle.match(/text-align\s*:\s*(right|center)/i);
  if (textAlignMatch) {
    return textAlignMatch[1].toLowerCase();
  }

  const childStyleMatch = html.match(/<(?:span|img)\b[^>]*\bstyle\s*=\s*(["'])(.*?)\1/i);
  const childStyle = childStyleMatch?.[2] || "";
  const childFloatMatch = childStyle.match(/float\s*:\s*(left|right)/i);
  if (childFloatMatch) {
    return childFloatMatch[1].toLowerCase();
  }
  const childTextAlignMatch = childStyle.match(/text-align\s*:\s*(right|center)/i);
  if (childTextAlignMatch) {
    return childTextAlignMatch[1].toLowerCase();
  }
  return "";
};

const applyGoogleDocImageAlignment = (html: string) =>
  html.replace(/<p\b[^>]*>[\s\S]*?<\/p>/gi, (paragraph) => {
    if (!/<img\b/i.test(paragraph)) {
      return paragraph;
    }
    const alignment = detectGoogleDocBlockAlignment(paragraph);
    if (!alignment) {
      return paragraph;
    }
    return paragraph.replace(/<img\b[^>]*>/gi, (imageTag) =>
      setHtmlClass(imageTag, `align${alignment}`),
    );
  });

const buildResponsiveImageStyle = (alignment: string) => {
  const base = "max-width:100%;height:auto;";
  if (alignment === "right") {
    return `${base}float:right;margin:0 0 1em 1.5em;`;
  }
  if (alignment === "left") {
    return `${base}float:left;margin:0 1.5em 1em 0;`;
  }
  if (alignment === "center") {
    return `${base}display:block;margin-left:auto;margin-right:auto;`;
  }
  return base;
};

const normalizeStyleAttribute = (style: string, tagName: string) => {
  const allowedByTag: Record<string, Set<string>> = {
    a: new Set(["color", "text-decoration"]),
    span: new Set(["color", "font-weight", "font-style", "text-decoration"]),
    strong: new Set(["font-weight"]),
    em: new Set(["font-style"]),
    p: new Set(["text-align"]),
    h1: new Set(["text-align"]),
    h2: new Set(["text-align"]),
    h3: new Set(["text-align"]),
    h4: new Set(["text-align"]),
    h5: new Set(["text-align"]),
    h6: new Set(["text-align"]),
  };
  const allowed = allowedByTag[tagName];
  if (!allowed) {
    return "";
  }
  return style
    .split(";")
    .map((declaration) => declaration.trim())
    .filter(Boolean)
    .map((declaration) => {
      const separatorIndex = declaration.indexOf(":");
      if (separatorIndex === -1) {
        return "";
      }
      const property = declaration.slice(0, separatorIndex).trim().toLowerCase();
      const value = declaration.slice(separatorIndex + 1).trim();
      return allowed.has(property) ? `${property}:${value}` : "";
    })
    .filter(Boolean)
    .join(";");
};

const setImageAttribute = (imageTag: string, attribute: string, value: string) => {
  const escaped = escapeHtml(value);
  if (new RegExp(`\\b${attribute}\\s*=`, "i").test(imageTag)) {
    return imageTag.replace(
      new RegExp(`\\b${attribute}\\s*=\\s*(["'])(.*?)\\1`, "i"),
      `${attribute}="${escaped}"`,
    );
  }
  return imageTag.replace(/\s*\/?>$/, ` ${attribute}="${escaped}" />`);
};

const makeGoogleDocHtmlResponsive = (html: string) =>
  html.replace(/<([a-z][a-z0-9]*)\b([^>]*)>/gi, (tag, rawTagName: string) => {
    const tagName = rawTagName.toLowerCase();
    const existingClass = getHtmlAttribute(tag, "class");
    let updated = tag.replace(/\s*\bclass\s*=\s*(["'])(.*?)\1/i, "");
    if (!/^h[1-6]$/.test(tagName)) {
      updated = updated.replace(/\s*\bid\s*=\s*(["'])(.*?)\1/i, "");
    }

    const style = getHtmlAttribute(updated, "style");
    if (style) {
      const cleanStyle = normalizeStyleAttribute(style, tagName);
      updated = cleanStyle
        ? updated.replace(/\bstyle\s*=\s*(["'])(.*?)\1/i, `style="${escapeHtml(cleanStyle)}"`)
        : updated.replace(/\s*\bstyle\s*=\s*(["'])(.*?)\1/i, "");
    }

    if (tagName === "img") {
      const alignment = extractAlignmentFromClass(existingClass);
      if (alignment) {
        updated = setHtmlClass(updated, `align${alignment}`);
      }
      updated = setImageAttribute(updated, "style", buildResponsiveImageStyle(alignment));
      updated = updated.replace(/\s*\bwidth\s*=\s*(["'])(.*?)\1/i, "");
      updated = updated.replace(/\s*\bheight\s*=\s*(["'])(.*?)\1/i, "");
    }

    return updated;
  });

const normalizeGoogleDocHtml = (html: string, baseUrl: string) =>
  makeGoogleDocHtmlResponsive(
    applyGoogleDocImageAlignment(
      normalizeGoogleDocLinks(
        absolutizeImageSources(
          convertInlineStyledHeadings(
            removeGoogleDocMetadataBlocks(
              stripFrontMatterFromHtml(
                applyGoogleDocImageMetadataBlocks(
                  stripGoogleDocChrome(inlineGoogleDocClassStyles(extractBodyHtml(html), html)),
                ),
              ),
            ),
          ).replace(
            /<p\b([^>]*)>\s*(#{1,3})\s+([\s\S]*?)<\/p>/gi,
            (_all, _attrs: string, hashes: string, text: string) =>
              `<h${hashes.length}>${text.trim()}</h${hashes.length}>`,
          ),
          baseUrl,
        ),
        baseUrl,
      ),
    ),
  )
    .replace(/<p\b[^>]*>\s*<\/p>/gi, "")
    .trim();

const hasUsefulGoogleDocHtml = (html: string) =>
  Boolean(htmlToText(html).trim() || /<img\b/i.test(html));

const isGoogleDocHtmlExportComplete = (html: string, fallbackHtml: string) => {
  if (!hasUsefulGoogleDocHtml(html)) {
    return false;
  }
  const htmlTextLength = htmlToText(html).length;
  const fallbackTextLength = htmlToText(fallbackHtml).length;
  if (fallbackTextLength <= 0) {
    return true;
  }
  return htmlTextLength >= Math.max(80, Math.floor(fallbackTextLength * 0.6));
};

const mergeImageItems = (items: GoogleDocImage[]) => {
  const indexByUrl = new Map<string, number>();
  const merged: GoogleDocImage[] = [];
  for (const item of items) {
    if (!item.url) {
      continue;
    }
    const existingIndex = indexByUrl.get(item.url);
    if (existingIndex !== undefined) {
      const existing = merged[existingIndex];
      merged[existingIndex] = {
        ...existing,
        altText: existing.altText || item.altText,
        title: existing.title || item.title,
        caption: existing.caption || item.caption,
        imageBase64: existing.imageBase64 || item.imageBase64,
        mimeType: existing.mimeType || item.mimeType,
      };
      continue;
    }
    indexByUrl.set(item.url, merged.length);
    merged.push(item);
  }
  return merged;
};

const fetchGoogleDocHtml = async (documentId: string) => {
  const candidates = [
    `${GOOGLE_DOCS_BASE_URL}/${documentId}/export?format=html`,
    `${GOOGLE_DOCS_BASE_URL}/${documentId}/mobilebasic`,
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
  const htmlFromDoc = htmlExport ? normalizeGoogleDocHtml(htmlExport.html, htmlExport.url) : "";
  const htmlImages = htmlExport
    ? mergeImageItems([
        ...extractImageItemsFromHtml(htmlExport.html, htmlExport.url),
        ...extractImageItemsFromHtml(htmlFromDoc, htmlExport.url),
      ])
    : [];
  const featuredImage = parsed.featuredImageUrl
    ? { url: parsed.featuredImageUrl, altText: "", title: "", caption: "" }
    : htmlImages[0];
  const images = mergeImageItems([
    ...(featuredImage ? [featuredImage] : []),
    ...htmlImages,
  ]);
  const imageUrls = images.map((image) => image.url);
  const featuredImageUrl = featuredImage?.url;
  const baseHtml = isGoogleDocHtmlExportComplete(htmlFromDoc, parsed.html) ? htmlFromDoc : parsed.html;
  const html = baseHtml;

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
