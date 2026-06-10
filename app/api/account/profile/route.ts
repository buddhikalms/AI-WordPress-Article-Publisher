import { NextResponse } from "next/server";
import { requireVerifiedUser } from "@/lib/auth-session";
import { updateProfileSchema } from "@/lib/account-schemas";
import { toErrorResponse } from "@/lib/errors";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function PATCH(request: Request) {
  try {
    const user = await requireVerifiedUser(request);
    const json = await request.json();
    const validation = updateProfileSchema.safeParse(json);

    if (!validation.success) {
      return NextResponse.json(
        {
          error: "Invalid profile details.",
          details: validation.error.flatten(),
        },
        { status: 400 },
      );
    }

    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        name: validation.data.name,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        emailVerified: true,
        tokenBalance: true,
      },
    });

    return NextResponse.json({
      message: "Profile updated.",
      user: updatedUser,
    });
  } catch (error) {
    return toErrorResponse(error, "Failed to update profile.");
  }
}
