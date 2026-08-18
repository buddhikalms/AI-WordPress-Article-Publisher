import { HttpError } from "@/lib/errors";
import {
  deriveFocusKeyword,
  hydrateGeneratedMeta,
  parseJsonFromModel,
} from "@/lib/openai";
import {
  generatedArticleResponseSchema,
  type GenerateArticleRequest,
  type GenerateArticleResponsePayload,
} from "@/lib/schemas";
import type { NewsSourceArticle } from "@/lib/newsdata";

const defaultOllamaModel = process.env.OLLAMA_TEXT_MODEL || "llama3.1";
const ollamaTimeoutMs = Number(process.env.OLLAMA_TIMEOUT_MS) || 180_000;

const getOllamaBaseUrl = () => {
  const baseUrl = process.env.OLLAMA_BASE_URL;
  if (!baseUrl) {
    throw new HttpError(
      500,
      "OLLAMA_BASE_URL is missing. Add it to .env.local before generating with Ollama.",
    );
  }
  return baseUrl.replace(/\/+$/, "");
};

const callOllamaChat = async (input: {
  model?: string;
  system: string;
  user: string;
  temperature: number;
}): Promise<string> => {
  const baseUrl = getOllamaBaseUrl();
  const model = input.model?.trim() || defaultOllamaModel;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ollamaTimeoutMs);

  let response: Response;
  try {
    response = await fetch(`${baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        stream: false,
        format: "json",
        options: { temperature: input.temperature },
        messages: [
          { role: "system", content: input.system },
          { role: "user", content: input.user },
        ],
      }),
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new HttpError(
        504,
        `Ollama did not respond within ${Math.round(ollamaTimeoutMs / 1000)}s. Check that the model is loaded and the server is reachable at ${baseUrl}.`,
      );
    }
    throw new HttpError(
      502,
      `Failed to reach Ollama at ${baseUrl}. ${error instanceof Error ? error.message : ""}`.trim(),
    );
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    const bodyText = await response.text().catch(() => "");
    throw new HttpError(
      502,
      `Ollama request failed with status ${response.status}.`,
      bodyText ? { body: bodyText.slice(0, 500) } : undefined,
    );
  }

  const data = (await response.json()) as { message?: { content?: string } };
  const content = data.message?.content;
  if (!content) {
    throw new HttpError(502, "Ollama returned an empty response.");
  }
  return content;
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

  const content = await callOllamaChat({
    model: input.model,
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

  const parsed = parseJsonFromModel(content);
  const validation = generatedArticleResponseSchema.safeParse(parsed);
  if (!validation.success) {
    throw new HttpError(
      502,
      "Ollama response did not match the expected article schema.",
      validation.error.flatten(),
    );
  }

  const generated = validation.data;
  if (generated.html.includes("```")) {
    throw new HttpError(
      502,
      "Ollama returned markdown fences instead of pure HTML.",
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

export const rewriteNewsAsOriginalArticle = async (input: {
  category: string;
  tone: string;
  wordCount: number;
  model?: string;
  article: NewsSourceArticle;
}): Promise<GenerateArticleResponsePayload> => {
  const content = await callOllamaChat({
    model: input.model,
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

  const parsed = parseJsonFromModel(content);
  const validation = generatedArticleResponseSchema.safeParse(parsed);
  if (!validation.success) {
    throw new HttpError(
      502,
      "Ollama response did not match the expected rewritten article schema.",
      validation.error.flatten(),
    );
  }

  const generated = validation.data;
  if (generated.html.includes("```")) {
    throw new HttpError(
      502,
      "Ollama returned markdown fences instead of pure HTML.",
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
