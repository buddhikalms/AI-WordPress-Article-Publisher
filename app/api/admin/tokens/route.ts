import { NextResponse } from "next/server";
import { TokenReason } from "@prisma/client";
import { requireAdminUser } from "@/lib/auth-session";
import { adminTokenAdjustSchema } from "@/lib/account-schemas";
import { toErrorResponse, HttpError } from "@/lib/errors";
import { creditTokens, debitTokens } from "@/lib/tokens";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    await requireAdminUser(request);

    const body = await request.json();
    const parsed = adminTokenAdjustSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid token adjustment payload.",
          details: parsed.error.flatten(),
        },
        { status: 400 },
      );
    }

    const { userId, amount, description } = parsed.data;

    if (amount === 0) {
      throw new HttpError(400, "Amount cannot be zero.");
    }

    if (amount > 0) {
      const tokenBalance = await creditTokens({
        userId,
        amount,
        reason: TokenReason.ADMIN_ADJUSTMENT,
        description: description || "Admin token credit",
        referenceType: "admin_adjustment",
      });

      return NextResponse.json({
        ok: true,
        tokenBalance,
      });
    }

    const tokenBalance = await debitTokens({
      userId,
      amount: Math.abs(amount),
      reason: TokenReason.ADMIN_ADJUSTMENT,
      description: description || "Admin token debit",
      referenceType: "admin_adjustment",
    });

    return NextResponse.json({
      ok: true,
      tokenBalance,
    });
  } catch (error) {
    return toErrorResponse(error, "Failed to adjust tokens.");
  }
}
