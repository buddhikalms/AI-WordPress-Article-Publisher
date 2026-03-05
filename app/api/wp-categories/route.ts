import { NextResponse } from "next/server";
import { z } from "zod";
import { toErrorResponse } from "@/lib/errors";
import { createCategory, listCategories } from "@/lib/wp";
import { requireVerifiedUser } from "@/lib/auth-session";
import { getUserWordPressConfig } from "@/lib/user-wordpress";

export const runtime = "nodejs";

const createCategorySchema = z.object({
  name: z.string().trim().min(1).max(80),
});

export async function GET(request: Request) {
  try {
    const user = await requireVerifiedUser(request);
    const siteId = new URL(request.url).searchParams.get("siteId") || undefined;
    const wpConfig = await getUserWordPressConfig(user.id, siteId);
    const categories = await listCategories(wpConfig);
    return NextResponse.json({ categories });
  } catch (error) {
    return toErrorResponse(error, "Failed to load WordPress categories.");
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireVerifiedUser(request);
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

    const wpConfig = await getUserWordPressConfig(user.id, json.siteId || undefined);
    const category = await createCategory(validation.data.name, wpConfig);
    return NextResponse.json({ category });
  } catch (error) {
    return toErrorResponse(error, "Failed to create WordPress category.");
  }
}
