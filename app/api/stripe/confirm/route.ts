import { NextResponse } from "next/server";
import { requireVerifiedUser } from "@/lib/auth-session";
import { checkoutConfirmSchema } from "@/lib/account-schemas";
import { HttpError, toErrorResponse } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { getStripeClient } from "@/lib/stripe";
import { markPackagePurchaseAsFailed, markPackagePurchaseAsPaid } from "@/lib/stripe-purchases";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const user = await requireVerifiedUser(request);
    const body = await request.json();
    const parsed = checkoutConfirmSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid checkout confirmation payload.",
          details: parsed.error.flatten(),
        },
        { status: 400 },
      );
    }

    const purchase = await prisma.packagePurchase.findUnique({
      where: {
        stripeCheckoutSessionId: parsed.data.sessionId,
      },
      select: {
        id: true,
        userId: true,
        status: true,
      },
    });

    if (!purchase) {
      throw new HttpError(404, "Checkout session not found.");
    }

    if (purchase.userId !== user.id) {
      throw new HttpError(403, "This checkout session does not belong to your account.");
    }

    const stripe = getStripeClient();
    const session = await stripe.checkout.sessions.retrieve(parsed.data.sessionId);

    if (session.mode !== "payment") {
      throw new HttpError(400, "Unsupported Stripe checkout mode.");
    }

    if (session.payment_status === "paid") {
      await markPackagePurchaseAsPaid(session);
    } else if (session.status === "expired" || session.payment_status === "unpaid") {
      await markPackagePurchaseAsFailed(session);
    }

    const [nextPurchase, nextUser] = await Promise.all([
      prisma.packagePurchase.findUnique({
        where: {
          id: purchase.id,
        },
        select: {
          status: true,
        },
      }),
      prisma.user.findUnique({
        where: {
          id: user.id,
        },
        select: {
          tokenBalance: true,
        },
      }),
    ]);

    return NextResponse.json({
      ok: true,
      purchaseStatus: nextPurchase?.status || purchase.status,
      paymentStatus: session.payment_status,
      checkoutStatus: session.status,
      tokenBalance: nextUser?.tokenBalance ?? user.tokenBalance,
    });
  } catch (error) {
    return toErrorResponse(error, "Failed to confirm Stripe checkout.");
  }
}
