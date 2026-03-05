import { NextResponse } from "next/server";
import { getErrorMessage } from "@/lib/errors";
import { getCurrentUser } from "@/lib/wp";
import { requireVerifiedUser } from "@/lib/auth-session";
import { getUserWordPressConfig } from "@/lib/user-wordpress";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const user = await requireVerifiedUser(request);
    const siteId = new URL(request.url).searchParams.get("siteId") || undefined;
    const wpConfig = await getUserWordPressConfig(user.id, siteId);
    const me = await getCurrentUser(wpConfig);
    return NextResponse.json({
      ok: true,
      user: {
        id: me.id ?? null,
        name: me.name ?? null,
        slug: me.slug ?? null,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: getErrorMessage(error, "WordPress health check failed."),
      },
      { status: 500 },
    );
  }
}
