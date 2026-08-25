import { HttpError } from "@/lib/errors";
import {
  deriveFocusKeyword,
  hydrateGeneratedMeta,
  normalizeGeneratedArticleCandidate,
  parseJsonFromModel,
  slugify,
} from "@/lib/openai";
import {
  generatedArticleResponseSchema,
  type EditArticleRequest,
  type GenerateArticleRequest,
  type GenerateArticleResponsePayload,
} from "@/lib/schemas";
import type { NewsSourceArticle } from "@/lib/newsdata";
import type { InlineGeneratedImage } from "@/lib/types";

const defaultGeminiModel = process.env.GEMINI_TEXT_MODEL || "gemini-3.5-flash";
const defaultGeminiImageModel = process.env.GEMINI_IMAGE_MODEL || "gemini-3.1-flash-image";
const geminiTimeoutMs = Number(process.env.GEMINI_TIMEOUT_MS) || 180_000;

type GeminiAuthInput = { apiKey?: string };

const getGeminiApiKey = (apiKey?: string) => {
  const resolvedApiKey = apiKey?.trim() || process.env.GEMINI_API_KEY;
  if (!resolvedApiKey) {
    throw new HttpError(
      500,
      "Gemini API key is missing. Add it in AI Keys or configure GEMINI_API_KEY.",
    );
  }
  return resolvedApiKey;
};

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

const callGemini = async (input: {
  model?: string;
  apiKey?: string;
  system: string;
  user: string;
  temperature: number;
}): Promise<string> => {
  const apiKey = getGeminiApiKey(input.apiKey);
  const model = input.model?.trim() || defaultGeminiModel;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), geminiTimeoutMs);

  let response: Response;
  try {
    response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
        model,
      )}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        signal: controller.signal,
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: input.system }],
          },
          contents: [
            {
              role: "user",
              parts: [{ text: input.user }],
            },
          ],
          generationConfig: {
            temperature: input.temperature,
            responseMimeType: "application/json",
          },
        }),
      },
    );
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new HttpError(
        504,
        `Gemini did not respond within ${Math.round(geminiTimeoutMs / 1000)}s.`,
      );
    }
    throw new HttpError(
      502,
      `Failed to reach Gemini. ${error instanceof Error ? error.message : ""}`.trim(),
    );
  } finally {
    clearTimeout(timeout);
  }

  const bodyText = await response.text();
  let data: {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    error?: { message?: string };
  };
  try {
    data = JSON.parse(bodyText);
  } catch {
    throw new HttpError(502, "Gemini returned an invalid JSON response.", {
      body: bodyText.slice(0, 500),
    });
  }

  if (!response.ok) {
    throw new HttpError(
      502,
      data.error?.message || `Gemini request failed with status ${response.status}.`,
      data,
    );
  }

  const content = data.candidates?.[0]?.content?.parts
    ?.map((part) => part.text || "")
    .join("\n")
    .trim();

  if (!content) {
    throw new HttpError(502, "Gemini returned an empty response.", data);
  }

  return content;
};


type GeminiImagePart = {
  text?: string;
  thought?: boolean;
  inlineData?: { mimeType?: string; data?: string };
  inline_data?: { mime_type?: string; data?: string };
};

const extractGeminiImage = (data: {
  candidates?: Array<{ content?: { parts?: GeminiImagePart[] } }>;
}) => {
  const parts = data.candidates?.[0]?.content?.parts || [];
  for (const part of parts) {
    if (part.thought) {
      continue;
    }
    const inlineData = part.inlineData ||
      (part.inline_data
        ? {
            mimeType: part.inline_data.mime_type,
            data: part.inline_data.data,
          }
        : undefined);
    if (inlineData?.data) {
      return {
        imageBase64: inlineData.data,
        mimeType: inlineData.mimeType || "image/png",
      };
    }
  }
  return null;
};

const callGeminiImage = async (input: {
  prompt: string;
  apiKey?: string;
  model?: string;
}) => {
  const apiKey = getGeminiApiKey(input.apiKey);
  const model = input.model?.trim() || defaultGeminiImageModel;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), geminiTimeoutMs);

  let response: Response;
  try {
    response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
        model,
      )}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [{ text: input.prompt }],
            },
          ],
          generationConfig: {
            responseModalities: ["IMAGE"],
          },
        }),
      },
    );
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new HttpError(
        504,
        `Gemini image generation did not respond within ${Math.round(geminiTimeoutMs / 1000)}s.`,
      );
    }
    throw new HttpError(
      502,
      `Failed to reach Gemini image generation. ${error instanceof Error ? error.message : ""}`.trim(),
    );
  } finally {
    clearTimeout(timeout);
  }

  const bodyText = await response.text();
  let data: {
    candidates?: Array<{ content?: { parts?: GeminiImagePart[] } }>;
    error?: { message?: string };
  };
  try {
    data = JSON.parse(bodyText);
  } catch {
    throw new HttpError(502, "Gemini image generation returned an invalid JSON response.", {
      body: bodyText.slice(0, 500),
    });
  }

  if (!response.ok) {
    throw new HttpError(
      response.status === 429 ? 429 : 502,
      data.error?.message || `Gemini image generation failed with status ${response.status}.`,
      data,
    );
  }

  const image = extractGeminiImage(data);
  if (!image) {
    throw new HttpError(502, "Gemini image response did not contain image data.", data);
  }

  return image;
};

export const generateFeaturedImage = async (input: {
  title: string;
  brief: string;
  model?: string;
  apiKey?: string;
}) => {
  const stem = slugify(input.title) || "featured-image";
  const image = await callGeminiImage({
    model: input.model,
    apiKey: input.apiKey,
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

export const generateInlineArticleImages = async (input: {
  title: string;
  brief: string;
  count: number;
  model?: string;
  apiKey?: string;
}): Promise<InlineGeneratedImage[]> => {
  if (input.count <= 0) {
    return [];
  }

  const stem = slugify(input.title) || "article";
  const images: InlineGeneratedImage[] = [];

  for (let index = 1; index <= input.count; index += 1) {
    const generated = await callGeminiImage({
      model: input.model,
      apiKey: input.apiKey,
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

export const generateArticleDraft = async (
  input: GenerateArticleRequest & GeminiAuthInput,
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

  const content = await callGemini({
    model: input.model,
    apiKey: input.apiKey,
    temperature: 0.4,
    system: [
      "You are a senior editorial SEO strategist and human copywriter creating WordPress-ready content.",
      "Write with a natural human voice, clear structure, and strong search-intent alignment.",
      "Avoid robotic filler, generic AI phrases, keyword stuffing, and cheap clickbait.",
      "Every title, heading, excerpt, and SEO field must feel human, useful, and SEO-friendly.",
      "Follow constraints exactly.",
      "Respond with a single JSON object only. No markdown, no code fences, no commentary outside the JSON.",
    ].join(" "),
    user: [
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
  });

  const parsed = normalizeGeneratedArticleCandidate(
    parseJsonFromModel(content),
    input.title,
    input.brief || input.title,
    input.focusKeyword,
  );
  const validation = generatedArticleResponseSchema.safeParse(parsed);
  if (!validation.success) {
    throw new HttpError(
      502,
      "Gemini response did not match the expected article schema.",
      validation.error.flatten(),
    );
  }

  const generated = validation.data;
  if (generated.html.includes("```")) {
    throw new HttpError(
      502,
      "Gemini returned markdown fences instead of pure HTML.",
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
  input: EditArticleRequest & GeminiAuthInput,
): Promise<GenerateArticleResponsePayload> => {
  const requiredLinks = input.links.filter((link) => link.required);
  const requiredLinksPrompt =
    requiredLinks.length > 0
      ? requiredLinks
          .map(formatLinkForPrompt)
          .join("\n")
      : "None";

  const content = await callGemini({
    model: input.model,
    apiKey: input.apiKey,
    temperature: 0.25,
    system: [
      "You are a senior WordPress editor revising an existing SEO article.",
      "Apply the user's edit instructions precisely while preserving useful structure, factual consistency, and WordPress-ready HTML.",
      "Respond with a single JSON object only. No markdown, no code fences, no commentary outside the JSON.",
    ].join(" "),
    user: [
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
  });

  const parsed = normalizeGeneratedArticleCandidate(
    parseJsonFromModel(content),
    input.title,
    input.excerpt || input.brief || input.title,
    input.focusKeyword,
  );
  const validation = generatedArticleResponseSchema.safeParse(parsed);
  if (!validation.success) {
    throw new HttpError(
      502,
      "Gemini response did not match the expected edited article schema.",
      validation.error.flatten(),
    );
  }

  const generated = validation.data;
  if (generated.html.includes("```")) {
    throw new HttpError(
      502,
      "Gemini returned markdown fences instead of pure HTML.",
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

export const rewriteNewsAsOriginalArticle = async (input: {
  category: string;
  tone: string;
  wordCount: number;
  model?: string;
  apiKey?: string;
  article: NewsSourceArticle;
}): Promise<GenerateArticleResponsePayload> => {
  const content = await callGemini({
    model: input.model,
    apiKey: input.apiKey,
    temperature: 0.45,
    system: [
      "You are an editor producing original, factual, SEO-ready WordPress news articles.",
      "Write with a natural human voice, clean news judgment, and clear search-intent alignment.",
      "Avoid robotic filler, repeated phrasing, and sensational clickbait.",
      "Every title, excerpt, and SEO field must sound human and be optimized for discoverability.",
      "Respond with a single JSON object only. No markdown, no code fences, no commentary outside the JSON.",
    ].join(" "),
    user: [
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
  });

  const fallbackKeywordFromSource = deriveFocusKeyword(input.article.title);
  const parsed = normalizeGeneratedArticleCandidate(
    parseJsonFromModel(content),
    input.article.title,
    input.article.description || input.article.title,
    fallbackKeywordFromSource,
  );
  const validation = generatedArticleResponseSchema.safeParse(parsed);
  if (!validation.success) {
    throw new HttpError(
      502,
      "Gemini response did not match the expected rewritten article schema.",
      validation.error.flatten(),
    );
  }

  const generated = validation.data;
  if (generated.html.includes("```")) {
    throw new HttpError(
      502,
      "Gemini returned markdown fences instead of pure HTML.",
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
