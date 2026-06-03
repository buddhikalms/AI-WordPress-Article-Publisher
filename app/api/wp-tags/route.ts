import { NextResponse } from "next/server";
import { z } from "zod";
import { toErrorResponse } from "@/lib/errors";
import { createTag, listTags } from "@/lib/wp";
import { requireVerifiedUser } from "@/lib/auth-session";
import { getUserWordPressConfig } from "@/lib/user-wordpress";

export const runtime = "nodejs";

const createTagSchema = z.object({
  siteId: z.string().trim().min(1).optional(),
  name: z.string().trim().min(1).max(80),
});

export async function GET(request: Request) {
  try {
    const user = await requireVerifiedUser(request);
    const siteId = new URL(request.url).searchParams.get("siteId") || undefined;
    const wpConfig = await getUserWordPressConfig(user.id, siteId);
    const tags = await listTags(wpConfig);
    return NextResponse.json({ tags });
  } catch (error) {
    return toErrorResponse(error, "Failed to load WordPress tags.");
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireVerifiedUser(request);
    const json = await request.json();
    const validation = createTagSchema.safeParse(json);
    if (!validation.success) {
      return NextResponse.json(
        {
          error: "Invalid request payload.",
          details: validation.error.flatten(),
        },
        { status: 400 },
      );
    }

    const wpConfig = await getUserWordPressConfig(user.id, validation.data.siteId);
    const tag = await createTag(validation.data.name, wpConfig);
    return NextResponse.json({ tag });
  } catch (error) {
    return toErrorResponse(error, "Failed to create WordPress tag.");
  }
}
