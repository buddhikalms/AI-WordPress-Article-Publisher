import { z } from "zod";

const emptyToUndefined = (value: unknown) => {
  if (typeof value === "string" && value.trim() === "") {
    return undefined;
  }
  return value;
};

const optionalUrlSchema = z.preprocess(
  emptyToUndefined,
  z.string().trim().url().optional(),
);

export const seoProviderSchema = z.enum(["AIOSEO", "Yoast", "None"]);

export const hyperlinkSchema = z.object({
  url: z.string().trim().url("Each hyperlink URL must be valid."),
  anchorText: z.string().trim().min(1, "Anchor text is required."),
  required: z.boolean().default(false),
});

const keywordsSchema = z
  .union([z.array(z.string()), z.string()])
  .transform((value) => {
    const items = Array.isArray(value) ? value : value.split(",");
    return [...new Set(items.map((item) => item.trim()).filter(Boolean))];
  });

export const generateArticleRequestSchema = z.object({
  title: z.string().trim().min(3, "Title is required."),
  brief: z.string().trim().min(10, "Topic/brief is required."),
  keywords: keywordsSchema,
  focusKeyword: z.string().trim().min(1, "Focus keyword is required."),
  tone: z.string().trim().min(1, "Tone is required."),
  wordCount: z.coerce.number().int().min(300).max(5000),
  links: z.array(hyperlinkSchema).max(50),
});

export const socialMetaSchema = z.object({
  title: z.string().trim().min(1, "Social title is required."),
  description: z.string().trim().min(1, "Social description is required."),
  imageUrl: optionalUrlSchema,
});

export const seoPayloadSchema = z.object({
  seoTitle: z.string().trim().min(1, "SEO title is required."),
  metaDescription: z.string().trim().min(1, "Meta description is required."),
  focusKeyword: z.string().trim().min(1, "Focus keyword is required."),
  canonicalUrl: optionalUrlSchema,
  og: socialMetaSchema,
  twitter: socialMetaSchema,
});

export const generatedArticleResponseSchema = z.object({
  html: z.string().trim().min(40),
  meta: z.object({
    title: z.string().trim().min(1),
    excerpt: z.string().trim().min(1),
    suggestedTags: z.array(z.string().trim().min(1)).max(20),
    seo: seoPayloadSchema,
  }),
});

export const generateImageRequestSchema = z.object({
  title: z.string().trim().min(3),
  brief: z.string().trim().min(10),
});

const optionalStringSchema = z.preprocess(
  emptyToUndefined,
  z.string().trim().optional(),
);

export const publishRequestSchema = z
  .object({
    title: z.string().trim().min(3),
    html: z.string().trim().min(40),
    excerpt: z.string().trim().min(1),
    status: z.enum(["draft", "publish"]),
    featuredImageBase64: optionalStringSchema,
    featuredImageMime: optionalStringSchema,
    seoProvider: seoProviderSchema,
    seoPayload: seoPayloadSchema,
  })
  .superRefine((value, context) => {
    if (value.featuredImageBase64 && !value.featuredImageMime) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["featuredImageMime"],
        message: "featuredImageMime is required when featuredImageBase64 is set.",
      });
    }
  });

export type GenerateArticleRequest = z.infer<typeof generateArticleRequestSchema>;
export type GenerateArticleResponsePayload = z.infer<
  typeof generatedArticleResponseSchema
>;
export type GenerateImageRequest = z.infer<typeof generateImageRequestSchema>;
export type PublishRequestPayload = z.infer<typeof publishRequestSchema>;
export type SeoProviderInput = z.infer<typeof seoProviderSchema>;

