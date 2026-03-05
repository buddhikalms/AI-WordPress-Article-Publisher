import OpenAI from "openai";
import { HttpError } from "@/lib/errors";
import {
  generatedArticleResponseSchema,
  type GenerateArticleRequest,
  type GenerateArticleResponsePayload,
} from "@/lib/schemas";
import type { InlineGeneratedImage } from "@/lib/types";
import type { NewsSourceArticle } from "@/lib/newsdata";

const defaultTextModel = process.env.OPENAI_TEXT_MODEL || "gpt-4.1-mini";
const imageModel = "gpt-image-1";

let openaiClient: OpenAI | null = null;

const getClient = () => {
  if (!process.env.OPENAI_API_KEY) {
    throw new HttpError(
      500,
      "OPENAI_API_KEY is missing. Add it to .env.local before calling this endpoint.",
    );
  }
  if (!openaiClient) {
    openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openaiClient;
};

const slugify = (input: string) =>
  input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

const parseJsonFromModel = (content: string): unknown => {
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

const hydrateGeneratedMeta = (
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
  input: GenerateArticleRequest,
): Promise<GenerateArticleResponsePayload> => {
  const requiredLinks = input.links.filter((link) => link.required);
  const optionalLinks = input.links.filter((link) => !link.required);

  const requiredLinksPrompt =
    requiredLinks.length > 0
      ? requiredLinks
          .map(
            (link, index) =>
              `${index + 1}. <a href="${link.url}">${link.anchorText}</a>`,
          )
          .join("\n")
      : "None";

  const optionalLinksPrompt =
    optionalLinks.length > 0
      ? optionalLinks
          .map(
            (link, index) =>
              `${index + 1}. <a href="${link.url}">${link.anchorText}</a>`,
          )
          .join("\n")
      : "None";

  const client = getClient();
  const completion = await client.chat.completions.create({
    model: defaultTextModel,
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

const deriveFocusKeyword = (title: string) =>
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
  article: NewsSourceArticle;
}): Promise<GenerateArticleResponsePayload> => {
  const client = getClient();
  const completion = await client.chat.completions.create({
    model: defaultTextModel,
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
