import { NextResponse } from "next/server";
import { requireVerifiedUser } from "@/lib/auth-session";
import { checkoutSchema } from "@/lib/account-schemas";
import { toErrorResponse, HttpError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { getStripeClient } from "@/lib/stripe";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const user = await requireVerifiedUser(request);
    const body = await request.json();
    const parsed = checkoutSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid checkout payload.",
          details: parsed.error.flatten(),
        },
        { status: 400 },
      );
    }

    const selectedPackage = await prisma.package.findUnique({
      where: {
        id: parsed.data.packageId,
      },
    });

    if (!selectedPackage || !selectedPackage.isActive) {
      throw new HttpError(404, "Selected package is unavailable.");
    }

    if (!selectedPackage.stripePriceId) {
      throw new HttpError(400, "This package is missing a Stripe price ID.");
    }

    if (!/^price_[A-Za-z0-9]+$/.test(selectedPackage.stripePriceId)) {
      throw new HttpError(
        400,
        "Invalid Stripe price ID on this package. Use a Stripe Price ID like price_... in admin.",
      );
    }

    if (!user.email) {
      throw new HttpError(400, "Your account email is required for checkout.");
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL;
    if (!appUrl) {
      throw new HttpError(500, "APP_URL or NEXT_PUBLIC_APP_URL is required.");
    }

    const stripe = getStripeClient();
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          price: selectedPackage.stripePriceId,
          quantity: 1,
        },
      ],
      customer_email: user.email,
      success_url: `${appUrl}/billing?status=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/billing?status=cancelled`,
      metadata: {
        userId: user.id,
        packageId: selectedPackage.id,
      },
    });

    await prisma.packagePurchase.create({
      data: {
        userId: user.id,
        packageId: selectedPackage.id,
        status: "PENDING",
        tokensGranted: selectedPackage.tokenAmount,
        amountCents: selectedPackage.priceCents,
        currency: selectedPackage.currency,
        stripeCheckoutSessionId: session.id,
        metadata: {
          checkoutUrl: session.url,
        },
      },
    });

    return NextResponse.json({
      ok: true,
      checkoutUrl: session.url,
      sessionId: session.id,
    });
  } catch (error) {
    return toErrorResponse(error, "Failed to create Stripe checkout session.");
  }
}
