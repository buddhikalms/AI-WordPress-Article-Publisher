import { NextResponse } from "next/server";
import { compare, hash } from "bcryptjs";
import { requireVerifiedUser } from "@/lib/auth-session";
import { changePasswordSchema } from "@/lib/account-schemas";
import { HttpError, toErrorResponse } from "@/lib/errors";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function PATCH(request: Request) {
  try {
    const user = await requireVerifiedUser(request);
    const json = await request.json();
    const validation = changePasswordSchema.safeParse(json);

    if (!validation.success) {
      return NextResponse.json(
        {
          error: "Invalid password details.",
          details: validation.error.flatten(),
        },
        { status: 400 },
      );
    }

    const account = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        passwordHash: true,
      },
    });

    if (!account?.passwordHash) {
      throw new HttpError(
        400,
        "This account does not have a password yet. Sign in with your connected provider or reset your login method.",
      );
    }

    const isCurrentPasswordValid = await compare(
      validation.data.currentPassword,
      account.passwordHash,
    );
    if (!isCurrentPasswordValid) {
      throw new HttpError(400, "Current password is incorrect.");
    }

    const passwordHash = await hash(validation.data.newPassword, 12);
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
      },
    });

    return NextResponse.json({
      message: "Password changed.",
    });
  } catch (error) {
    return toErrorResponse(error, "Failed to change password.");
  }
}
