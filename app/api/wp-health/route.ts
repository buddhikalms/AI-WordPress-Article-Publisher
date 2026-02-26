import { NextResponse } from "next/server";
import { getErrorMessage } from "@/lib/errors";
import { getCurrentUser } from "@/lib/wp";

export const runtime = "nodejs";

export async function GET() {
  try {
    const me = await getCurrentUser();
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

