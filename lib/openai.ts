import OpenAI from "openai";
import { HttpError } from "@/lib/errors";
import {
  generatedArticleResponseSchema,
  type GenerateArticleRequest,
  type GenerateArticleResponsePayload,
} from "@/lib/schemas";

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
        content:
          "You are an expert SEO writer creating WordPress-ready content. Follow constraints exactly.",
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

  generated.meta.seo.focusKeyword =
    generated.meta.seo.focusKeyword || input.focusKeyword;
  generated.meta.seo.seoTitle = generated.meta.seo.seoTitle || input.title;
  generated.meta.seo.metaDescription =
    generated.meta.seo.metaDescription || generated.meta.excerpt;
  generated.meta.seo.og.title =
    generated.meta.seo.og.title || generated.meta.seo.seoTitle;
  generated.meta.seo.og.description =
    generated.meta.seo.og.description || generated.meta.seo.metaDescription;
  generated.meta.seo.twitter.title =
    generated.meta.seo.twitter.title || generated.meta.seo.seoTitle;
  generated.meta.seo.twitter.description =
    generated.meta.seo.twitter.description || generated.meta.seo.metaDescription;

  return generated;
};

export const generateFeaturedImage = async (input: {
  title: string;
  brief: string;
}) => {
  const client = getClient();
  const prompt = [
    `Create a professional featured image for an article titled "${input.title}".`,
    `Article brief: ${input.brief}`,
    "Style: editorial, clean, high-quality, realistic or polished illustration.",
    "Important: no text overlays, no logos, no watermarks.",
  ].join(" ");

  const image = await client.images.generate({
    model: imageModel,
    prompt,
    size: "1536x1024",
  });

  const imageBase64 = image.data?.[0]?.b64_json;
  if (!imageBase64) {
    throw new HttpError(502, "OpenAI image response did not contain base64 data.");
  }

  const stem = slugify(input.title) || "featured-image";
  return {
    imageBase64,
    mimeType: "image/png",
    filenameSuggestion: `${stem}.png`,
    altTextSuggestion: `Featured image for ${input.title}`,
  };
};

