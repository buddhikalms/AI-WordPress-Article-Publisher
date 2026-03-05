import { NextResponse } from "next/server";
import { verifyEmailSchema } from "@/lib/account-schemas";
import { toErrorResponse } from "@/lib/errors";
import { verifyEmailCode } from "@/lib/email-verification";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = verifyEmailSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid verification payload.",
          details: parsed.error.flatten(),
        },
        { status: 400 },
      );
    }

    await verifyEmailCode(parsed.data);

    return NextResponse.json({
      ok: true,
      message: "Email verified. You can now sign in.",
    });
  } catch (error) {
    return toErrorResponse(error, "Email verification failed.");
  }
}