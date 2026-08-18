import { NextResponse } from "next/server";
import { toErrorResponse } from "@/lib/errors";
import { newsAutoPublishRequestSchema } from "@/lib/schemas";
import { requireVerifiedUser } from "@/lib/auth-session";
import { runNewsAutopilot } from "@/lib/services/news-autopilot";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const user = await requireVerifiedUser(request);
    const json = await request.json();
    const validation = newsAutoPublishRequestSchema.safeParse(json);
    if (!validation.success) {
      return NextResponse.json(
        {
          error: "Invalid request payload.",
          details: validation.error.flatten(),
        },
        { status: 400 },
      );
    }

    const requestSeed =
      request.headers.get("x-request-id") || crypto.randomUUID();

    const result = await runNewsAutopilot({
      userId: user.id,
      tokenBalance: user.tokenBalance,
      requestSeed,
      payload: validation.data,
    });

    return NextResponse.json(result);
  } catch (error) {
    return toErrorResponse(error, "Failed to auto-publish category news.");
  }
}
