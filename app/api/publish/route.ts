import { NextResponse } from "next/server";
import { toErrorResponse } from "@/lib/errors";
import { publishRequestSchema } from "@/lib/schemas";
import { requireVerifiedUser } from "@/lib/auth-session";
import { publishArticleForUser } from "@/lib/services/publishing";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const user = await requireVerifiedUser(request);
    const json = await request.json();
    const validation = publishRequestSchema.safeParse(json);
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

    const result = await publishArticleForUser({
      userId: user.id,
      tokenBalance: user.tokenBalance,
      requestId,
      payload: validation.data,
    });

    return NextResponse.json(result);
  } catch (error) {
    return toErrorResponse(error, "Failed to publish post to WordPress.");
  }
}
