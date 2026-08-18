import { TokenReason } from "@prisma/client";
import { HttpError } from "@/lib/errors";
import {
  dedupeRequiredLinksInHtml,
  enforceLinkPoliciesInHtml,
  validateRequiredLinks,
} from "@/lib/link-validation";
import { generateArticleDraft } from "@/lib/ai";
import { consumeTokens, TOKEN_COSTS } from "@/lib/tokens";
import type { GenerateArticleRequest, GenerateArticleResponsePayload } from "@/lib/schemas";
import type { HyperlinkInput } from "@/lib/types";

export type GenerateArticleContentResult =
  | {
      ok: true;
      html: string;
      meta: GenerateArticleResponsePayload["meta"];
      tokenCharge: { charged: boolean; amount: number; remaining: number };
    }
  | {
      ok: false;
      missing: HyperlinkInput[];
      duplicates: HyperlinkInput[];
    };

export const generateArticleContent = async (params: {
  userId: string;
  tokenBalance: number;
  requestId: string;
  input: GenerateArticleRequest;
}): Promise<GenerateArticleContentResult> => {
  if (params.tokenBalance < TOKEN_COSTS.ARTICLE_GENERATION) {
    throw new HttpError(402, "Insufficient tokens. Please buy a package.");
  }

  const generated = await generateArticleDraft(params.input);
  generated.html = dedupeRequiredLinksInHtml(generated.html, params.input.links);
  generated.html = enforceLinkPoliciesInHtml(generated.html, params.input.links);

  const linkValidation = validateRequiredLinks(generated.html, params.input.links);
  if (
    linkValidation.missing.length > 0 ||
    linkValidation.duplicateRequired.length > 0
  ) {
    return {
      ok: false,
      missing: linkValidation.missing,
      duplicates: linkValidation.duplicateRequired,
    };
  }

  const tokenCharge = await consumeTokens({
    userId: params.userId,
    amount: TOKEN_COSTS.ARTICLE_GENERATION,
    reason: TokenReason.ARTICLE_GENERATION,
    action: "ARTICLE_GENERATION",
    description: `Article generation for "${params.input.title}"`,
    requestId: `article:${params.requestId}`,
    referenceType: "article_generation",
  });

  return {
    ok: true,
    html: generated.html,
    meta: generated.meta,
    tokenCharge: {
      charged: tokenCharge.charged,
      amount: TOKEN_COSTS.ARTICLE_GENERATION,
      remaining: tokenCharge.tokenBalance,
    },
  };
};
