import { NextResponse } from "next/server";
import { toErrorResponse } from "@/lib/errors";
import { generateFeaturedImage } from "@/lib/openai";
import { generateImageRequestSchema } from "@/lib/schemas";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
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

    const image = await generateFeaturedImage(validation.data);
    return NextResponse.json(image);
  } catch (error) {
    return toErrorResponse(error, "Failed to generate featured image.");
  }
}

