import type Stripe from "stripe";
import { TokenReason } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const toPackagePurchaseMetadataInput = (metadata: Record<string, unknown>) =>
  metadata as unknown as string;

const toPaymentIntentId = (value: string | Stripe.PaymentIntent | null) => {
  if (!value) {
    return null;
  }

  if (typeof value === "string") {
    return value;
  }

  return value.id;
};

export const markPackagePurchaseAsPaid = async (session: Stripe.Checkout.Session) => {
  if (session.payment_status !== "paid") {
    return false;
  }

  const purchase = await prisma.packagePurchase.findUnique({
    where: {
      stripeCheckoutSessionId: session.id,
    },
    include: {
      package: true,
    },
  });

  if (!purchase || purchase.status === "PAID") {
    return false;
  }

  let applied = false;

  await prisma.$transaction(async (tx) => {
    const existing = await tx.packagePurchase.findUnique({
      where: {
        id: purchase.id,
      },
      select: {
        status: true,
        userId: true,
        tokensGranted: true,
      },
    });

    if (!existing || existing.status === "PAID") {
      return;
    }

    const updatedUser = await tx.user.update({
      where: {
        id: existing.userId,
      },
      data: {
        tokenBalance: {
          increment: existing.tokensGranted,
        },
      },
      select: {
        tokenBalance: true,
      },
    });

    await tx.packagePurchase.update({
      where: {
        id: purchase.id,
      },
      data: {
        status: "PAID",
        stripePaymentIntentId: toPaymentIntentId(session.payment_intent),
        metadata: toPackagePurchaseMetadataInput({
          ...(typeof purchase.metadata === "object" && purchase.metadata ? purchase.metadata : {}),
          paymentStatus: session.payment_status,
        }),
      },
    });

    await tx.tokenTransaction.create({
      data: {
        userId: existing.userId,
        amount: existing.tokensGranted,
        balanceAfter: updatedUser.tokenBalance,
        reason: TokenReason.PACKAGE_PURCHASE,
        description: `Stripe package purchase: ${purchase.package.name}`,
        referenceType: "stripe_checkout",
        referenceId: session.id,
      },
    });

    applied = true;
  });

  return applied;
};

export const markPackagePurchaseAsFailed = async (session: Stripe.Checkout.Session) => {
  await prisma.packagePurchase.updateMany({
    where: {
      stripeCheckoutSessionId: session.id,
      status: {
        in: ["PENDING"],
      },
    },
    data: {
      status: "FAILED",
      stripePaymentIntentId: toPaymentIntentId(session.payment_intent),
    },
  });
};
