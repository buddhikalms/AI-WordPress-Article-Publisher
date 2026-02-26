import { NextResponse } from "next/server";
import { toErrorResponse } from "@/lib/errors";
import {
  dedupeRequiredLinksInHtml,
  enforceLinkPoliciesInHtml,
  validateRequiredLinks,
} from "@/lib/link-validation";
import { generateArticleDraft } from "@/lib/openai";
import { generateArticleRequestSchema } from "@/lib/schemas";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
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

    return NextResponse.json(generated);
  } catch (error) {
    return toErrorResponse(error, "Failed to generate article draft.");
  }
}
