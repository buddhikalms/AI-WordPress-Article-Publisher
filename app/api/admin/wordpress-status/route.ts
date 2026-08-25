import { NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/auth-session";
import { toErrorResponse } from "@/lib/errors";
import { getAdminWordPressStatus } from "@/lib/services/wordpress-admin-status";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await requireAdminUser(request);
    const sites = await getAdminWordPressStatus();

    return NextResponse.json(
      { sites },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return toErrorResponse(error, "Failed to load WordPress status.");
  }
}
