import OpenAI from "openai";
import { HttpError } from "@/lib/errors";
import {
  generatedArticleResponseSchema,
  type EditArticleRequest,
  type GenerateArticleRequest,
  type GenerateArticleResponsePayload,
} from "@/lib/schemas";
import type { InlineGeneratedImage, SeoPayload } from "@/lib/types";
import type { NewsSourceArticle } from "@/lib/newsdata";

const defaultTextModel = process.env.OPENAI_TEXT_MODEL || "gpt-4.1-mini";
const imageModel = "gpt-image-1";

let openaiClient: OpenAI | null = null;

type OpenAiAuthInput = { apiKey?: string };

const getClient = (apiKey?: string) => {
  const resolvedApiKey = apiKey?.trim() || process.env.OPENAI_API_KEY;
  if (!resolvedApiKey) {
    throw new HttpError(
      500,
      "OpenAI API key is missing. Add it in AI Keys or configure OPENAI_API_KEY.",
    );
  }
  if (apiKey?.trim()) {
    return new OpenAI({ apiKey: resolvedApiKey });
  }
  if (!openaiClient) {
    openaiClient = new OpenAI({ apiKey: resolvedApiKey });
  }
  return openaiClient;
};

export const slugify = (input: string) =>
  input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

export const parseJsonFromModel = (content: string): unknown => {
  try {
    return JSON.parse(content);
  } catch {
    const start = content.indexOf("{");
    const end = content.lastIndexOf("}");
    if (start === -1 || end === -1 || end <= start) {
      throw new HttpError(502, "OpenAI response did not contain valid JSON.");
    }
    const extracted = content.slice(start, end + 1);
    try {
      return JSON.parse(extracted);
    } catch {
      throw new HttpError(502, "Failed to parse OpenAI JSON output.");
    }
  }
};

const normalizeText = (value: string) =>
  value
    .replace(/\s+/g, " ")
    .replace(/^["'`]+|["'`]+$/g, "")
    .trim();

const trimToWordBoundary = (value: string, maxLength: number) => {
  const normalized = normalizeText(value);
  if (normalized.length <= maxLength) {
    return normalized;
  }

  const slice = normalized.slice(0, maxLength + 1);
  const lastSpace = slice.lastIndexOf(" ");
  const trimmed =
    lastSpace >= Math.floor(maxLength * 0.6)
      ? slice.slice(0, lastSpace)
      : normalized.slice(0, maxLength);

  return trimmed.replace(/[,:;/-]+$/g, "").trim();
};

const finalizeSentence = (value: string) => {
  const normalized = normalizeText(value).replace(/\s+([,.;!?])/g, "$1");
  if (!normalized) {
    return normalized;
  }
  return /[.!?]$/.test(normalized) ? normalized : `${normalized}.`;
};

const cleanHeadline = (
  value: string | undefined,
  fallback: string,
  maxLength: number,
) => {
  const cleaned = trimToWordBoundary(value || fallback, maxLength).replace(
    /[.!?,;:]+$/g,
    "",
  );

  return cleaned || trimToWordBoundary(fallback, maxLength);
};

const cleanSummary = (
  value: string | undefined,
  fallback: string,
  maxLength: number,
) => finalizeSentence(trimToWordBoundary(value || fallback, maxLength));

const cleanSuggestedTags = (tags: string[]) =>
  [...new Set(tags.map((tag) => normalizeText(tag)).filter(Boolean))].slice(
    0,
    10,
  );

const formatLinkForPrompt = (link: {
  url: string;
  anchorText: string;
  required: boolean;
  followType: "dofollow" | "nofollow";
}, index: number) => {
  const rel = link.followType === "nofollow" ? "noopener noreferrer nofollow" : "noopener noreferrer";
  return [
    `${index + 1}. URL: ${link.url}`,
    `Anchor text: "${link.anchorText}"`,
    `Required: ${link.required ? "yes, include exactly once" : "optional, include only when natural"}`,
    `Follow rule: ${link.followType}`,
    `Required HTML policy: <a href="${link.url}" target="_blank" rel="${rel}">${link.anchorText}</a>`,
  ].join(" | ");
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const asRecord = (value: unknown): Record<string, unknown> =>
  isRecord(value) ? value : {};

const asString = (value: unknown, fallback = "") =>
  typeof value === "string" ? value : fallback;

const asOptionalUrl = (value: unknown) =>
  typeof value === "string" && value.trim() ? value : undefined;

const asStringArray = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof item === "string" ? item.trim() : ""))
      .filter(Boolean);
  }
  if (typeof value === "string") {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
};

export const normalizeGeneratedArticleCandidate = (
  candidate: unknown,
  fallbackTitle: string,
  fallbackExcerpt: string,
  fallbackKeyword: string,
) => {
  const root = asRecord(candidate);
  const article =
    asRecord(root.article).html || asRecord(root.article).meta
      ? asRecord(root.article)
      : asRecord(root.draft).html || asRecord(root.draft).meta
      ? asRecord(root.draft)
      : root;
  const meta = asRecord(article.meta);
  const rootSeo = asRecord(article.seo);
  const seo = Object.keys(asRecord(meta.seo)).length > 0 ? asRecord(meta.seo) : rootSeo;
  const og = asRecord(seo.og);
  const twitter = asRecord(seo.twitter);
  const title =
    asString(meta.title) ||
    asString(article.title) ||
    asString(root.title) ||
    fallbackTitle;
  const excerpt =
    asString(meta.excerpt) ||
    asString(article.excerpt) ||
    asString(article.summary) ||
    asString(root.excerpt) ||
    fallbackExcerpt ||
    title;
  const seoTitle =
    asString(seo.seoTitle) ||
    asString(seo.title) ||
    asString(rootSeo.seoTitle) ||
    title;
  const metaDescription =
    asString(seo.metaDescription) ||
    asString(seo.description) ||
    asString(rootSeo.metaDescription) ||
    excerpt;
  const focusKeyword =
    asString(seo.focusKeyword) ||
    asString(rootSeo.focusKeyword) ||
    fallbackKeyword;

  return {
    html: asString(article.html) || asString(article.content) || "",
    meta: {
      title,
      excerpt,
      suggestedTags:
        asStringArray(meta.suggestedTags).length > 0
          ? asStringArray(meta.suggestedTags)
          : asStringArray(meta.tags).length > 0
          ? asStringArray(meta.tags)
          : asStringArray(article.suggestedTags).length > 0
          ? asStringArray(article.suggestedTags)
          : asStringArray(article.tags),
      seo: {
        seoTitle,
        metaDescription,
        focusKeyword,
        canonicalUrl: asOptionalUrl(seo.canonicalUrl || rootSeo.canonicalUrl),
        og: {
          title: asString(og.title) || seoTitle,
          description: asString(og.description) || metaDescription,
          imageUrl: asOptionalUrl(og.imageUrl),
        },
        twitter: {
          title: asString(twitter.title) || asString(og.title) || seoTitle,
          description:
            asString(twitter.description) ||
            asString(og.description) ||
            metaDescription,
          imageUrl: asOptionalUrl(twitter.imageUrl || og.imageUrl),
        },
      },
    },
  };
};

export const hydrateGeneratedMeta = (
  meta: GenerateArticleResponsePayload["meta"],
  fallbackTitle: string,
  fallbackExcerpt: string,
  fallbackKeyword: string,
): GenerateArticleResponsePayload["meta"] => {
  const title = cleanHeadline(meta.title, fallbackTitle, 72);
  const excerpt = cleanSummary(meta.excerpt, fallbackExcerpt || title, 180);
  const focusKeyword =
    normalizeText(meta.seo.focusKeyword || fallbackKeyword) ||
    deriveFocusKeyword(title);
  const seoTitle = cleanHeadline(meta.seo.seoTitle, title, 60);
  const metaDescription = cleanSummary(
    meta.seo.metaDescription,
    excerpt,
    155,
  );

  return {
    ...meta,
    title,
    excerpt,
    suggestedTags: cleanSuggestedTags(meta.suggestedTags),
    seo: {
      ...meta.seo,
      seoTitle,
      metaDescription,
      focusKeyword,
      og: {
        ...meta.seo.og,
        title: cleanHeadline(meta.seo.og.title, seoTitle, 60),
        description: cleanSummary(meta.seo.og.description, metaDescription, 155),
      },
      twitter: {
        ...meta.seo.twitter,
        title: cleanHeadline(meta.seo.twitter.title, seoTitle, 60),
        description: cleanSummary(
          meta.seo.twitter.description,
          metaDescription,
          155,
        ),
      },
    },
  };
};

export const generateArticleDraft = async (
  input: GenerateArticleRequest & OpenAiAuthInput,
): Promise<GenerateArticleResponsePayload> => {
  const requiredLinks = input.links.filter((link) => link.required);
  const optionalLinks = input.links.filter((link) => !link.required);

  const requiredLinksPrompt =
    requiredLinks.length > 0
      ? requiredLinks
          .map(formatLinkForPrompt)
          .join("\n")
      : "None";

  const optionalLinksPrompt =
    optionalLinks.length > 0
      ? optionalLinks
          .map(formatLinkForPrompt)
          .join("\n")
      : "None";

  const client = getClient(input.apiKey);
  const completion = await client.chat.completions.create({
    model: input.model?.trim() || defaultTextModel,
    temperature: 0.4,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: [
          "You are a senior editorial SEO strategist and human copywriter creating WordPress-ready content.",
          "Write with a natural human voice, clear structure, and strong search-intent alignment.",
          "Avoid robotic filler, generic AI phrases, keyword stuffing, and cheap clickbait.",
          "Every title, heading, excerpt, and SEO field must feel human, useful, and SEO-friendly.",
          "Follow constraints exactly.",
        ].join(" "),
      },
      {
        role: "user",
        content: [
          "Return a JSON object with this exact shape:",
          "{",
          '  "html": "<valid wordpress html>",',
          '  "meta": {',
          '    "title": "string",',
          '    "excerpt": "string",',
          '    "suggestedTags": ["string"],',
          '    "seo": {',
          '      "seoTitle": "string",',
          '      "metaDescription": "string",',
          '      "focusKeyword": "string",',
          '      "canonicalUrl": "optional absolute url",',
          '      "og": { "title": "string", "description": "string", "imageUrl": "optional absolute url" },',
          '      "twitter": { "title": "string", "description": "string", "imageUrl": "optional absolute url" }',
          "    }",
          "  }",
          "}",
          "",
          "Rules:",
          "- html MUST be valid WordPress-ready HTML only (no markdown, no code fences).",
          "- Include each required link exactly once using the exact anchor text and URL.",
          "- Optional links may be included only when natural.",
          '- Every link you include must open in a new tab with target="_blank".',
          '- Dofollow links must use rel="noopener noreferrer". Nofollow links must use rel="noopener noreferrer nofollow".',
          "- Follow the link table exactly for URL, anchor text, required/optional status, and dofollow/nofollow status.",
          "- Use h2/h3 headings, short paragraphs, and include a conclusion section.",
          "- Add an FAQ section at the end.",
          "- Rewrite weak phrasing so the article reads like a skilled human writer, not AI-generated copy.",
          "- Avoid cliches and filler such as 'in today's fast-paced world', 'delve', 'unlock', 'game-changing', or similar fluff.",
          "- Make meta.title a strong SEO headline. Improve the supplied title when a clearer, more searchable angle is available.",
          "- Make seoTitle concise and compelling, ideally around 50-60 characters.",
          "- Make metaDescription natural, benefit-led, and ideally around 140-155 characters without keyword stuffing.",
          "- Keep the focus keyword aligned to the primary search intent and use it naturally.",
          "",
          `Title: ${input.title}`,
          `Topic/Brief: ${input.brief}`,
          `Keywords: ${input.keywords.join(", ")}`,
          `Focus keyword: ${input.focusKeyword}`,
          `Tone: ${input.tone}`,
          `Target word count: ${input.wordCount}`,
          "",
          "Required links:",
          requiredLinksPrompt,
          "",
          "Optional links:",
          optionalLinksPrompt,
        ].join("\n"),
      },
    ],
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) {
    throw new HttpError(502, "OpenAI returned an empty draft response.");
  }

  const parsed = parseJsonFromModel(content);
  const validation = generatedArticleResponseSchema.safeParse(parsed);
  if (!validation.success) {
    throw new HttpError(
      502,
      "OpenAI response did not match the expected article schema.",
      validation.error.flatten(),
    );
  }

  const generated = validation.data;
  if (generated.html.includes("```")) {
    throw new HttpError(
      502,
      "OpenAI returned markdown fences instead of pure HTML.",
    );
  }

  return {
    ...generated,
    meta: hydrateGeneratedMeta(
      generated.meta,
      input.title,
      input.brief || input.title,
      input.focusKeyword,
    ),
  };
};

export const editArticleDraft = async (
  input: EditArticleRequest & OpenAiAuthInput,
): Promise<GenerateArticleResponsePayload> => {
  const requiredLinks = input.links.filter((link) => link.required);
  const requiredLinksPrompt =
    requiredLinks.length > 0
      ? requiredLinks
          .map(formatLinkForPrompt)
          .join("\n")
      : "None";

  const client = getClient(input.apiKey);
  const completion = await client.chat.completions.create({
    model: input.model?.trim() || defaultTextModel,
    temperature: 0.25,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: [
          "You are a senior WordPress editor revising an existing SEO article.",
          "Apply the user's edit instructions precisely while preserving useful structure, factual consistency, and WordPress-ready HTML.",
          "Do not add markdown fences or commentary outside JSON.",
        ].join(" "),
      },
      {
        role: "user",
        content: [
          "Return a JSON object with this exact shape:",
          "{",
          '  "html": "<valid wordpress html>",',
          '  "meta": {',
          '    "title": "string",',
          '    "excerpt": "string",',
          '    "suggestedTags": ["string"],',
          '    "seo": {',
          '      "seoTitle": "string",',
          '      "metaDescription": "string",',
          '      "focusKeyword": "string",',
          '      "canonicalUrl": "optional absolute url",',
          '      "og": { "title": "string", "description": "string", "imageUrl": "optional absolute url" },',
          '      "twitter": { "title": "string", "description": "string", "imageUrl": "optional absolute url" }',
          "    }",
          "  }",
          "}",
          "",
          "Rules:",
          "- Return revised WordPress-ready HTML only in html.",
          "- Keep each required link exactly once using the exact anchor text and URL.",
          '- Every link you include must open in a new tab with target="_blank".',
          '- Dofollow links must use rel="noopener noreferrer". Nofollow links must use rel="noopener noreferrer nofollow".',
          "- Follow the link table exactly for URL, anchor text, required/optional status, and dofollow/nofollow status.",
          "- Preserve strong sections unless the edit instructions ask to restructure.",
          "- Update title, excerpt, suggestedTags, and SEO fields to match the revised article.",
          "- Keep the writing natural, specific, and free of generic AI filler.",
          "",
          `Current title: ${input.title}`,
          `Current excerpt: ${input.excerpt || ""}`,
          `Original brief: ${input.brief}`,
          `Keywords: ${input.keywords.join(", ")}`,
          `Focus keyword: ${input.focusKeyword}`,
          `Tone: ${input.tone}`,
          `Target word count: ${input.wordCount}`,
          "",
          "Required links:",
          requiredLinksPrompt,
          "",
          "Edit instructions:",
          input.editPrompt,
          "",
          "Current article HTML:",
          input.html,
        ].join("\n"),
      },
    ],
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) {
    throw new HttpError(502, "OpenAI returned an empty edited draft response.");
  }

  const parsed = parseJsonFromModel(content);
  const validation = generatedArticleResponseSchema.safeParse(parsed);
  if (!validation.success) {
    throw new HttpError(
      502,
      "OpenAI response did not match the expected edited article schema.",
      validation.error.flatten(),
    );
  }

  const generated = validation.data;
  if (generated.html.includes("```")) {
    throw new HttpError(
      502,
      "OpenAI returned markdown fences instead of pure HTML.",
    );
  }

  return {
    ...generated,
    meta: hydrateGeneratedMeta(
      generated.meta,
      input.title,
      input.excerpt || input.brief || input.title,
      input.focusKeyword,
    ),
  };
};

export const generateFeaturedImage = async (input: {
  title: string;
  brief: string;
}) => {
  const stem = slugify(input.title) || "featured-image";
  const image = await generateArticleImage({
    prompt: [
      `Create a professional featured image for an article titled "${input.title}".`,
      `Article brief: ${input.brief}`,
      "Style: editorial, clean, high-quality, realistic or polished illustration.",
      "Important: no text overlays, no logos, no watermarks.",
    ].join(" "),
  });

  return {
    imageBase64: image.imageBase64,
    mimeType: image.mimeType,
    filenameSuggestion: `${stem}.png`,
    altTextSuggestion: `Featured image for ${input.title}`,
  };
};

const generateArticleImage = async (input: { prompt: string }) => {
  const client = getClient();
  const image = await client.images.generate({
    model: imageModel,
    prompt: input.prompt,
    size: "1536x1024",
  });

  const imageBase64 = image.data?.[0]?.b64_json;
  if (!imageBase64) {
    throw new HttpError(502, "OpenAI image response did not contain base64 data.");
  }

  return {
    imageBase64,
    mimeType: "image/png",
  };
};

export const generateInlineArticleImages = async (input: {
  title: string;
  brief: string;
  count: number;
}): Promise<InlineGeneratedImage[]> => {
  if (input.count <= 0) {
    return [];
  }

  const stem = slugify(input.title) || "article";
  const images: InlineGeneratedImage[] = [];

  for (let index = 1; index <= input.count; index += 1) {
    const generated = await generateArticleImage({
      prompt: [
        `Create in-article supporting image ${index} for an article titled "${input.title}".`,
        `Article brief: ${input.brief}`,
        `Visual variation ${index} of ${input.count}.`,
        "Style: professional editorial, consistent with a business/tech blog.",
        "Important: no text overlays, no logos, no watermarks.",
      ].join(" "),
    });

    images.push({
      imageBase64: generated.imageBase64,
      mimeType: generated.mimeType,
      filenameSuggestion: `${stem}-inline-${index}.png`,
      altTextSuggestion: `In-article visual ${index} for ${input.title}`,
    });
  }

  return images;
};

export const generateSeoPayloadForArticle = async (input: {
  title: string;
  html: string;
  excerpt?: string;
  focusKeyword?: string;
  canonicalUrl?: string;
}): Promise<SeoPayload> => {
  const plainText = normalizeText(input.html.replace(/<[^>]+>/g, " ")).slice(0, 6000);
  const fallbackExcerpt = input.excerpt || plainText.slice(0, 180) || input.title;
  const fallbackKeyword =
    normalizeText(input.focusKeyword || "") || deriveFocusKeyword(input.title);

  const client = getClient();
  const completion = await client.chat.completions.create({
    model: defaultTextModel,
    temperature: 0.25,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: [
          "You are an AIOSEO on-page SEO specialist.",
          "Generate concise, human SEO metadata for a pre-written WordPress article.",
          "Respect character limits exactly and avoid keyword stuffing.",
          "Return JSON only.",
        ].join(" "),
      },
      {
        role: "user",
        content: [
          "Return a JSON object with this exact shape:",
          "{",
          '  "seoTitle": "string",',
          '  "metaDescription": "string",',
          '  "focusKeyword": "string",',
          '  "canonicalUrl": "optional absolute url",',
          '  "og": { "title": "string", "description": "string", "imageUrl": "optional absolute url" },',
          '  "twitter": { "title": "string", "description": "string", "imageUrl": "optional absolute url" }',
          "}",
          "",
          "Limits:",
          "- seoTitle: max 60 characters, ideally 50-60.",
          "- metaDescription: max 155 characters, ideally 140-155.",
          "- og.title and twitter.title: max 60 characters.",
          "- og.description and twitter.description: max 155 characters.",
          "- focusKeyword: short primary phrase, 2-6 words.",
          "- Leave imageUrl empty unless the article explicitly provides a usable image URL.",
          "",
          `Title: ${input.title}`,
          `Existing excerpt: ${fallbackExcerpt}`,
          `Preferred focus keyword: ${fallbackKeyword}`,
          `Canonical URL: ${input.canonicalUrl || ""}`,
          "",
          "Article text:",
          plainText,
        ].join("\n"),
      },
    ],
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) {
    throw new HttpError(502, "OpenAI returned an empty SEO response.");
  }

  const parsed = parseJsonFromModel(content) as Partial<SeoPayload>;
  const seoTitle = cleanHeadline(parsed.seoTitle, input.title, 60);
  const metaDescription = cleanSummary(
    parsed.metaDescription,
    fallbackExcerpt,
    155,
  );

  return {
    seoTitle,
    metaDescription,
    focusKeyword:
      normalizeText(parsed.focusKeyword || fallbackKeyword) || fallbackKeyword,
    canonicalUrl: input.canonicalUrl,
    og: {
      title: cleanHeadline(parsed.og?.title, seoTitle, 60),
      description: cleanSummary(parsed.og?.description, metaDescription, 155),
      imageUrl: parsed.og?.imageUrl || "",
    },
    twitter: {
      title: cleanHeadline(parsed.twitter?.title, seoTitle, 60),
      description: cleanSummary(
        parsed.twitter?.description,
        metaDescription,
        155,
      ),
      imageUrl: parsed.twitter?.imageUrl || "",
    },
  };
};

export const deriveFocusKeyword = (title: string) =>
  title
    .split(/\s+/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 4)
    .join(" ");

export const rewriteNewsAsOriginalArticle = async (input: {
  category: string;
  tone: string;
  wordCount: number;
  provider?: "openai" | "gemini" | "ollama";
  model?: string;
  apiKey?: string;
  article: NewsSourceArticle;
}): Promise<GenerateArticleResponsePayload> => {
  const client = getClient(input.apiKey);
  const completion = await client.chat.completions.create({
    model: input.model?.trim() || defaultTextModel,
    temperature: 0.45,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: [
          "You are an editor producing original, factual, SEO-ready WordPress news articles.",
          "Write with a natural human voice, clean news judgment, and clear search-intent alignment.",
          "Avoid robotic filler, repeated phrasing, and sensational clickbait.",
          "Every title, excerpt, and SEO field must sound human and be optimized for discoverability.",
        ].join(" "),
      },
      {
        role: "user",
        content: [
          "Rewrite this news into a fully original article.",
          "Return JSON only with this exact shape:",
          "{",
          '  "html": "<valid wordpress html>",',
          '  "meta": {',
          '    "title": "string",',
          '    "excerpt": "string",',
          '    "suggestedTags": ["string"],',
          '    "seo": {',
          '      "seoTitle": "string",',
          '      "metaDescription": "string",',
          '      "focusKeyword": "string",',
          '      "canonicalUrl": "optional absolute url",',
          '      "og": { "title": "string", "description": "string", "imageUrl": "optional absolute url" },',
          '      "twitter": { "title": "string", "description": "string", "imageUrl": "optional absolute url" }',
          "    }",
          "  }",
          "}",
          "",
          "Hard rules:",
          "- Write from scratch using the facts only. Do not copy wording from source text.",
          "- Output WordPress-ready HTML only (no markdown, no code fences).",
          "- Use clear h2/h3 sections, short paragraphs, and a concise conclusion.",
          "- Preserve factual details and numbers; if a detail is uncertain, omit it.",
          "- Add a short source credit sentence at the end linking to the original source URL.",
          "- Rewrite the headline into a more compelling SEO-friendly news title when it improves clarity or search intent.",
          "- Keep the copy human, specific, and direct. Avoid filler such as 'in today's fast-paced world', 'delve', or 'game-changing'.",
          "- Make seoTitle concise and search-friendly, ideally around 50-60 characters.",
          "- Make metaDescription natural and ideally around 140-155 characters.",
          "",
          `Target category: ${input.category}`,
          `Tone: ${input.tone}`,
          `Target word count: ${input.wordCount}`,
          "",
          `Source title: ${input.article.title}`,
          `Source summary: ${input.article.description}`,
          `Source content: ${input.article.content}`,
          `Source link: ${input.article.link}`,
          `Source name: ${input.article.sourceName || "Unknown source"}`,
          `Source publishedAt: ${input.article.publishedAt || "Unknown"}`,
        ].join("\n"),
      },
    ],
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) {
    throw new HttpError(502, "OpenAI returned an empty rewritten article.");
  }

  const parsed = parseJsonFromModel(content);
  const validation = generatedArticleResponseSchema.safeParse(parsed);
  if (!validation.success) {
    throw new HttpError(
      502,
      "OpenAI response did not match the expected rewritten article schema.",
      validation.error.flatten(),
    );
  }

  const generated = validation.data;
  if (generated.html.includes("```")) {
    throw new HttpError(
      502,
      "OpenAI returned markdown fences instead of pure HTML.",
    );
  }

  const fallbackKeyword = deriveFocusKeyword(generated.meta.title || input.article.title);

  return {
    ...generated,
    meta: hydrateGeneratedMeta(
      generated.meta,
      input.article.title,
      input.article.description || input.article.title,
      fallbackKeyword,
    ),
  };
};
