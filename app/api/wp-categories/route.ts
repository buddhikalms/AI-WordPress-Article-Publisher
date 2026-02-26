import { NextResponse } from "next/server";
import { z } from "zod";
import { toErrorResponse } from "@/lib/errors";
import { createCategory, listCategories } from "@/lib/wp";

export const runtime = "nodejs";

const createCategorySchema = z.object({
  name: z.string().trim().min(1).max(80),
});

export async function GET() {
  try {
    const categories = await listCategories();
    return NextResponse.json({ categories });
  } catch (error) {
    return toErrorResponse(error, "Failed to load WordPress categories.");
  }
}

export async function POST(request: Request) {
  try {
    const json = await request.json();
    const validation = createCategorySchema.safeParse(json);
    if (!validation.success) {
      return NextResponse.json(
        {
          error: "Invalid request payload.",
          details: validation.error.flatten(),
        },
        { status: 400 },
      );
    }

    const category = await createCategory(validation.data.name);
    return NextResponse.json({ category });
  } catch (error) {
    return toErrorResponse(error, "Failed to create WordPress category.");
  }
}

