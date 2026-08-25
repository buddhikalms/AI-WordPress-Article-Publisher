import { NextResponse } from "next/server";
import { toErrorResponse } from "@/lib/errors";
import { requireVerifiedUser } from "@/lib/auth-session";
import { editArticleRequestSchema } from "@/lib/schemas";
import { editArticleContent } from "@/lib/services/article-generation";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const user = await requireVerifiedUser(request);
    const json = await request.json();
    const validation = editArticleRequestSchema.safeParse(json);
    if (!validation.success) {
      return NextResponse.json(
        {
          error: "Invalid edit request payload.",
          details: validation.error.flatten(),
        },
        { status: 400 },
      );
    }

    const requestId =
      request.headers.get("x-request-id") || crypto.randomUUID();

    const result = await editArticleContent({
      userId: user.id,
      tokenBalance: user.tokenBalance,
      requestId,
      input: validation.data,
    });

    if (!result.ok) {
      return NextResponse.json(
        {
          error:
            "Edited HTML failed required link enforcement. Please adjust the prompt and try again.",
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
    return toErrorResponse(error, "Failed to edit article draft.");
  }
}
