import Stripe from "stripe";
import { HttpError } from "@/lib/errors";

let stripeClient: Stripe | null = null;

export const getStripeClient = () => {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new HttpError(500, "STRIPE_SECRET_KEY is missing.");
  }

  if (!stripeClient) {
    stripeClient = new Stripe(secretKey);
  }

  return stripeClient;
};