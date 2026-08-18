import { NextResponse } from "next/server";
import { TokenReason } from "@prisma/client";
import { HttpError, toErrorResponse } from "@/lib/errors";
import {
  dedupeRequiredLinksInHtml,
  enforceLinkPoliciesInHtml,
  validateRequiredLinks,
} from "@/lib/link-validation";
import { generateArticleDraft } from "@/lib/ai";
import { requireVerifiedUser } from "@/lib/auth-session";
import { generateArticleRequestSchema } from "@/lib/schemas";
import { consumeTokens, TOKEN_COSTS } from "@/lib/tokens";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const user = await requireVerifiedUser(request);
    if (user.tokenBalance < TOKEN_COSTS.ARTICLE_GENERATION) {
      throw new HttpError(402, "Insufficient tokens. Please buy a package.");
    }
    const json = await request.json();
    const validation = generateArticleRequestSchema.safeParse(json);
    if (!validation.success) {
      return NextResponse.json(
        {
          error: "Invalid request payload.",
          details: validation.error.flatten(),
        },
        { status: 400 },
      );
    }

    const generated = await generateArticleDraft(validation.data);
    generated.html = dedupeRequiredLinksInHtml(
      generated.html,
      validation.data.links,
    );
    generated.html = enforceLinkPoliciesInHtml(
      generated.html,
      validation.data.links,
    );

    const linkValidation = validateRequiredLinks(
      generated.html,
      validation.data.links,
    );

    if (
      linkValidation.missing.length > 0 ||
      linkValidation.duplicateRequired.length > 0
    ) {
      return NextResponse.json(
        {
          error:
            "Generated HTML failed required link enforcement. Please regenerate.",
          missing: linkValidation.missing,
          duplicates: linkValidation.duplicateRequired,
        },
        { status: 400 },
      );
    }

    const requestId =
      request.headers.get("x-request-id") || crypto.randomUUID();

    const tokenCharge = await consumeTokens({
      userId: user.id,
      amount: TOKEN_COSTS.ARTICLE_GENERATION,
      reason: TokenReason.ARTICLE_GENERATION,
      action: "ARTICLE_GENERATION",
      description: `Article generation for "${validation.data.title}"`,
      requestId: `article:${requestId}`,
      referenceType: "article_generation",
    });

    return NextResponse.json({
      ...generated,
      tokenCharge: {
        charged: tokenCharge.charged,
        amount: TOKEN_COSTS.ARTICLE_GENERATION,
        remaining: tokenCharge.tokenBalance,
      },
    });
  } catch (error) {
    return toErrorResponse(error, "Failed to generate article draft.");
  }
}
