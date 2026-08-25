import { NextResponse } from "next/server";
import { TokenReason } from "@prisma/client";
import { HttpError, toErrorResponse } from "@/lib/errors";
import { generateFeaturedImage } from "@/lib/ai";
import { resolveAiProviderCredential } from "@/lib/ai-credentials";
import { requireVerifiedUser } from "@/lib/auth-session";
import { generateImageRequestSchema } from "@/lib/schemas";
import { consumeTokens, TOKEN_COSTS } from "@/lib/tokens";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const user = await requireVerifiedUser(request);
    if (user.tokenBalance < TOKEN_COSTS.IMAGE_GENERATION) {
      throw new HttpError(402, "Insufficient tokens. Please buy a package.");
    }
    const json = await request.json();
    const validation = generateImageRequestSchema.safeParse(json);
    if (!validation.success) {
      return NextResponse.json(
        {
          error: "Invalid request payload.",
          details: validation.error.flatten(),
        },
        { status: 400 },
      );
    }

    const credential = await resolveAiProviderCredential({
      userId: user.id,
      provider: validation.data.provider,
      requestedModel: validation.data.provider === "openai" ? validation.data.model : undefined,
    });
    const image = await generateFeaturedImage({
      ...validation.data,
      model: validation.data.provider === "openai"
        ? credential.model || validation.data.model
        : undefined,
      apiKey: credential.apiKey,
    });
    const requestId =
      request.headers.get("x-request-id") || crypto.randomUUID();

    const tokenCharge = await consumeTokens({
      userId: user.id,
      amount: TOKEN_COSTS.IMAGE_GENERATION,
      reason: TokenReason.IMAGE_GENERATION,
      action: "IMAGE_GENERATION",
      description: `Featured image generation for "${validation.data.title}"`,
      requestId: `image:${requestId}`,
      referenceType: "image_generation",
    });

    return NextResponse.json({
      ...image,
      tokenCharge: {
        charged: tokenCharge.charged,
        amount: TOKEN_COSTS.IMAGE_GENERATION,
        remaining: tokenCharge.tokenBalance,
      },
    });
  } catch (error) {
    return toErrorResponse(error, "Failed to generate featured image.");
  }
}
