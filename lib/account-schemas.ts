import { z } from "zod";

const emptyToUndefined = (value: unknown) => {
  if (typeof value === "string" && value.trim() === "") {
    return undefined;
  }

  return value;
};

const stripePriceIdSchema = z
  .string()
  .trim()
  .regex(/^price_[A-Za-z0-9]+$/, "Stripe price ID must look like price_...");

const optionalUrlSchema = z.preprocess(
  emptyToUndefined,
  z.string().trim().url().optional(),
);

const optionalShortStringSchema = z.preprocess(
  emptyToUndefined,
  z.string().trim().min(1).max(120).optional(),
);

const optionalPasswordSchema = z.preprocess(
  emptyToUndefined,
  z.string().trim().min(6).max(255).optional(),
);

export const registerUserSchema = z
  .object({
    name: z.string().trim().min(2).max(120),
    email: z.string().trim().email(),
    password: z.string().min(8).max(128),
    wordpressBaseUrl: optionalUrlSchema,
    wordpressUsername: optionalShortStringSchema,
    wordpressPassword: optionalPasswordSchema,
  })
  .superRefine((value, context) => {
    const hasAnyWordPressField = Boolean(
      value.wordpressBaseUrl || value.wordpressUsername || value.wordpressPassword,
    );

    if (!hasAnyWordPressField) {
      return;
    }

    if (!value.wordpressBaseUrl) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["wordpressBaseUrl"],
        message: "WordPress base URL is required when connecting a site.",
      });
    }

    if (!value.wordpressUsername) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["wordpressUsername"],
        message: "WordPress username is required when connecting a site.",
      });
    }

    if (!value.wordpressPassword) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["wordpressPassword"],
        message: "WordPress app password is required when connecting a site.",
      });
    }
  });

export const verifyEmailSchema = z.object({
  email: z.string().trim().email(),
  code: z.string().trim().regex(/^\d{6}$/),
});

export const resendVerificationSchema = z.object({
  email: z.string().trim().email(),
});

export const wordpressSiteSchema = z.object({
  siteId: z.preprocess(emptyToUndefined, z.string().trim().min(1).optional()),
  siteName: z.string().trim().min(2).max(80),
  wordpressBaseUrl: z.string().trim().url(),
  wordpressUsername: z.string().trim().min(1).max(120),
  wordpressPassword: optionalPasswordSchema,
  isDefault: z.boolean().optional().default(false),
});

export const deleteWordpressSiteSchema = z.object({
  siteId: z.string().trim().min(1),
});

export const setDefaultWordpressSiteSchema = z.object({
  siteId: z.string().trim().min(1),
});

export const updateProfileSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters.").max(120),
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required."),
    newPassword: z.string().min(8, "New password must be at least 8 characters.").max(128),
    confirmPassword: z.string().min(1, "Confirm your new password."),
  })
  .superRefine((value, context) => {
    if (value.newPassword !== value.confirmPassword) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["confirmPassword"],
        message: "New passwords do not match.",
      });
    }
    if (value.currentPassword === value.newPassword) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["newPassword"],
        message: "Choose a different password from your current password.",
      });
    }
  });

const packageBaseSchema = z.object({
  name: z.string().trim().min(2).max(120),
  slug: z.string().trim().min(2).max(120),
  description: z.preprocess(emptyToUndefined, z.string().trim().max(2000).optional()),
  featureList: z.array(z.string().trim().min(1).max(120)).max(30).optional(),
  priceCents: z.number().int().min(1),
  currency: z.string().trim().min(3).max(3),
  tokenAmount: z.number().int().min(1),
  stripeProductId: z.preprocess(emptyToUndefined, z.string().trim().optional()),
  stripePriceId: z.preprocess(emptyToUndefined, stripePriceIdSchema.optional()),
  isActive: z.boolean(),
});

export const createPackageSchema = packageBaseSchema.extend({
  currency: z.string().trim().min(3).max(3).default("usd"),
  isActive: z.boolean().default(true),
});

export const updatePackageSchema = packageBaseSchema.partial().extend({
  id: z.string().trim().min(1),
});

export const checkoutSchema = z.object({
  packageId: z.string().trim().min(1),
});

export const checkoutConfirmSchema = z.object({
  sessionId: z.string().trim().min(1),
});

export const adminTokenAdjustSchema = z.object({
  userId: z.string().trim().min(1),
  amount: z.number().int().min(-100000).max(100000),
  description: z.preprocess(emptyToUndefined, z.string().trim().max(500).optional()),
});
