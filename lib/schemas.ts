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

const optionalStringSchema = z.preprocess(
  emptyToUndefined,
  z.string().trim().optional(),
);

export const aiProviderSchema = z.enum(["openai", "ollama"]);
export const seoProviderSchema = z.enum(["AIOSEO", "Yoast", "None"]);
export const publishStatusSchema = z.enum(["draft", "publish", "future"]);

export const hyperlinkSchema = z.object({
  url: z.string().trim().url("Each hyperlink URL must be valid."),
  anchorText: z.string().trim().min(1, "Anchor text is required."),
  required: z.boolean().default(false),
  followType: z.enum(["dofollow", "nofollow"]).default("dofollow"),
});

const keywordsSchema = z
  .union([z.array(z.string()), z.string()])
  .transform((value) => {
    const items = Array.isArray(value) ? value : value.split(",");
    return [...new Set(items.map((item) => item.trim()).filter(Boolean))];
  });

const tagsSchema = z
  .union([z.array(z.string()), z.string()])
  .default([])
  .transform((value) => {
    const items = Array.isArray(value) ? value : value.split(",");
    return [...new Set(items.map((item) => item.trim()).filter(Boolean))].slice(0, 50);
  });

export const generateArticleRequestSchema = z.object({
  title: z.string().trim().min(3, "Title is required."),
  brief: z.string().trim().min(10, "Topic/brief is required."),
  keywords: keywordsSchema,
  focusKeyword: z.string().trim().min(1, "Focus keyword is required."),
  tone: z.string().trim().min(1, "Tone is required."),
  wordCount: z.coerce.number().int().min(300).max(5000),
  links: z.array(hyperlinkSchema).max(50),
  provider: aiProviderSchema.default("openai"),
  model: optionalStringSchema,
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

const optionalIdSchema = z.preprocess(
  emptyToUndefined,
  z.string().trim().min(1).optional(),
);

const optionalDateTimeSchema = z.preprocess(
  emptyToUndefined,
  z.string().datetime({ offset: true }).optional(),
);

export const publishRequestSchema = z
  .object({
    siteId: optionalIdSchema,
    title: z.string().trim().min(3),
    html: z.string().trim().min(40),
    brief: optionalStringSchema,
    excerpt: z.string().trim().min(1),
    status: publishStatusSchema,
    scheduledAt: optionalDateTimeSchema,
    featuredImageBase64: optionalStringSchema,
    featuredImageMime: optionalStringSchema,
    inPostImageCount: z.coerce.number().int().min(0).max(10).default(0),
    selectedCategoryIds: z.array(z.coerce.number().int().positive()).default([]),
    selectedCategoryNames: tagsSchema,
    newCategoryName: optionalStringSchema,
    selectedTagIds: z.array(z.coerce.number().int().positive()).default([]),
    selectedTagNames: tagsSchema,
    newTagNames: tagsSchema,
    suggestedTags: tagsSchema,
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
    if (value.newCategoryName && value.newCategoryName.length > 80) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["newCategoryName"],
        message: "New category name must be 80 characters or less.",
      });
    }
    if (value.status === "future" && !value.scheduledAt) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["scheduledAt"],
        message: "scheduledAt is required when status is future.",
      });
    }
    if (value.status !== "future" && value.scheduledAt) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["scheduledAt"],
        message: "scheduledAt is only allowed when status is future.",
      });
    }
    if (value.scheduledAt) {
      const scheduleDate = new Date(value.scheduledAt);
      if (Number.isNaN(scheduleDate.getTime())) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["scheduledAt"],
          message: "scheduledAt must be a valid ISO datetime.",
        });
      } else if (scheduleDate.getTime() <= Date.now()) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["scheduledAt"],
          message: "scheduledAt must be in the future.",
        });
      }
    }
  });

export const googleDocImportRequestSchema = z
  .object({
    siteId: optionalIdSchema,
    document: z.string().trim().min(3, "Google Doc URL or ID is required."),
    status: publishStatusSchema.default("draft"),
    scheduledAt: optionalDateTimeSchema,
    selectedCategoryIds: z.array(z.coerce.number().int().positive()).default([]),
    selectedCategoryNames: tagsSchema,
    newCategoryName: optionalStringSchema,
    selectedTagIds: z.array(z.coerce.number().int().positive()).default([]),
    selectedTagNames: tagsSchema,
    newTagNames: tagsSchema,
    seoProvider: seoProviderSchema.default("None"),
    skipImages: z.coerce.boolean().default(false),
  })
  .superRefine((value, context) => {
    if (value.status === "future" && !value.scheduledAt) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["scheduledAt"],
        message: "scheduledAt is required when status is future.",
      });
    }
    if (value.status !== "future" && value.scheduledAt) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["scheduledAt"],
        message: "scheduledAt is only allowed when status is future.",
      });
    }
    if (value.newCategoryName && value.newCategoryName.length > 80) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["newCategoryName"],
        message: "New category name must be 80 characters or less.",
      });
    }
    if (value.scheduledAt) {
      const scheduleDate = new Date(value.scheduledAt);
      if (Number.isNaN(scheduleDate.getTime())) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["scheduledAt"],
          message: "scheduledAt must be a valid ISO datetime.",
        });
      } else if (scheduleDate.getTime() <= Date.now()) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["scheduledAt"],
          message: "scheduledAt must be in the future.",
        });
      }
    }
  });

export const newsCategorySchema = z.enum([
  "business",
  "entertainment",
  "environment",
  "food",
  "health",
  "politics",
  "science",
  "sports",
  "technology",
  "top",
  "tourism",
  "world",
]);

export const newsAutoPublishRequestSchema = z
  .object({
    siteId: optionalIdSchema,
    category: newsCategorySchema,
    query: optionalStringSchema,
    language: z.preprocess(
      emptyToUndefined,
      z
        .string()
        .trim()
        .min(2, "Language must be at least 2 characters.")
        .max(10, "Language code must be 10 characters or less.")
        .optional(),
    ),
    maxArticles: z.coerce.number().int().min(1).max(5).default(1),
    tone: z.string().trim().min(1).default("Professional"),
    wordCount: z.coerce.number().int().min(300).max(5000).default(1200),
    status: publishStatusSchema.default("publish"),
    scheduledAt: optionalDateTimeSchema,
    selectedCategoryIds: z.array(z.coerce.number().int().positive()).default([]),
    newCategoryName: optionalStringSchema,
    selectedTagIds: z.array(z.coerce.number().int().positive()).default([]),
    newTagNames: tagsSchema,
    inPostImageCount: z.coerce.number().int().min(0).max(10).default(0),
    seoProvider: seoProviderSchema.default("None"),
    provider: aiProviderSchema.default("openai"),
    model: optionalStringSchema,
    skipImages: z.coerce.boolean().default(false),
  })
  .superRefine((value, context) => {
    if (value.status === "future" && !value.scheduledAt) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["scheduledAt"],
        message: "scheduledAt is required when status is future.",
      });
    }
    if (value.status !== "future" && value.scheduledAt) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["scheduledAt"],
        message: "scheduledAt is only allowed when status is future.",
      });
    }
    if (value.newCategoryName && value.newCategoryName.length > 80) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["newCategoryName"],
        message: "New category name must be 80 characters or less.",
      });
    }
    if (value.scheduledAt) {
      const scheduleDate = new Date(value.scheduledAt);
      if (Number.isNaN(scheduleDate.getTime())) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["scheduledAt"],
          message: "scheduledAt must be a valid ISO datetime.",
        });
      } else if (scheduleDate.getTime() <= Date.now()) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["scheduledAt"],
          message: "scheduledAt must be in the future.",
        });
      }
    }
  });

export type GenerateArticleRequest = z.infer<typeof generateArticleRequestSchema>;
export type GenerateArticleResponsePayload = z.infer<
  typeof generatedArticleResponseSchema
>;
export type GenerateImageRequest = z.infer<typeof generateImageRequestSchema>;
export type PublishRequestPayload = z.infer<typeof publishRequestSchema>;
export type GoogleDocImportRequestPayload = z.infer<
  typeof googleDocImportRequestSchema
>;
export type NewsAutoPublishRequestPayload = z.infer<
  typeof newsAutoPublishRequestSchema
>;
export type SeoProviderInput = z.infer<typeof seoProviderSchema>;
export type AiProviderInput = z.infer<typeof aiProviderSchema>;
