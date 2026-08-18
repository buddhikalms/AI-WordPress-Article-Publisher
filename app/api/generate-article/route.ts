import { NextResponse } from "next/server";
import { toErrorResponse } from "@/lib/errors";
import { requireVerifiedUser } from "@/lib/auth-session";
import { generateArticleRequestSchema } from "@/lib/schemas";
import { generateArticleContent } from "@/lib/services/article-generation";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const user = await requireVerifiedUser(request);
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

    const requestId =
      request.headers.get("x-request-id") || crypto.randomUUID();

    const result = await generateArticleContent({
      userId: user.id,
      tokenBalance: user.tokenBalance,
      requestId,
      input: validation.data,
    });

    if (!result.ok) {
      return NextResponse.json(
        {
          error:
            "Generated HTML failed required link enforcement. Please regenerate.",
          missing: result.missing,
          duplicates: result.duplicates,
        },
        { status: 400 },
      );
    }

    return NextResponse.json({
      html: result.html,
      meta: result.meta,
      tokenCharge: result.tokenCharge,
    });
  } catch (error) {
    return toErrorResponse(error, "Failed to generate article draft.");
  }
}
