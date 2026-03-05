import Stripe from "stripe";
import { NextResponse } from "next/server";
import { getStripeClient } from "@/lib/stripe";
import { markPackagePurchaseAsFailed, markPackagePurchaseAsPaid } from "@/lib/stripe-purchases";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const stripe = getStripeClient();
  const signature = request.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!signature || !webhookSecret) {
    return NextResponse.json(
      {
        error: "Stripe webhook signature or secret is missing.",
      },
      { status: 400 },
    );
  }

  const rawBody = await request.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Invalid webhook signature.",
      },
      { status: 400 },
    );
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      await markPackagePurchaseAsPaid(session);
    }

    if (event.type === "checkout.session.async_payment_succeeded") {
      const session = event.data.object as Stripe.Checkout.Session;
      await markPackagePurchaseAsPaid(session);
    }

    if (
      event.type === "checkout.session.async_payment_failed" ||
      event.type === "checkout.session.expired"
    ) {
      const session = event.data.object as Stripe.Checkout.Session;
      await markPackagePurchaseAsFailed(session);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      {
        error: "Webhook processing failed.",
      },
      { status: 500 },
    );
  }
}
