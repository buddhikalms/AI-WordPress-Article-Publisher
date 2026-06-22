import { z } from "zod";

const emptyToUndefined = (value: unknown) => typeof value === "string" && value.trim() === "" ? undefined : value;

export const inquiryTypes = ["General question", "Agency plan", "WordPress setup", "Billing", "Technical support"] as const;

export const contactInquirySchema = z.object({
  name: z.string().trim().min(2, "Enter your name.").max(120),
  email: z.string().trim().email("Enter a valid email address.").max(191),
  company: z.preprocess(emptyToUndefined, z.string().trim().max(120).optional()),
  websiteUrl: z.preprocess(emptyToUndefined, z.string().trim().url("Enter a complete website URL.").max(191).optional()),
  inquiryType: z.enum(inquiryTypes),
  message: z.string().trim().min(20, "Tell us a little more about your workflow.").max(5000),
});

export type ContactInquiryInput = z.infer<typeof contactInquirySchema>;
