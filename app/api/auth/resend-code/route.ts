import { NextResponse } from "next/server";
import { resendVerificationSchema } from "@/lib/account-schemas";
import { toErrorResponse, HttpError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { issueVerificationCode } from "@/lib/email-verification";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = resendVerificationSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid resend payload.",
          details: parsed.error.flatten(),
        },
        { status: 400 },
      );
    }

    const email = parsed.data.email.toLowerCase();
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        name: true,
        emailVerified: true,
      },
    });

    if (!user) {
      throw new HttpError(404, "No account found for this email.");
    }

    if (user.emailVerified) {
      return NextResponse.json({
        ok: true,
        message: "Email is already verified.",
      });
    }

    await issueVerificationCode({
      userId: user.id,
      email,
      name: user.name,
    });

    return NextResponse.json({
      ok: true,
      message: "A new verification code has been sent.",
    });
  } catch (error) {
    return toErrorResponse(error, "Failed to resend verification code.");
  }
}