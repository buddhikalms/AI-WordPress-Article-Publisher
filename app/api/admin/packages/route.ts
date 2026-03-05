import { NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/auth-session";
import { HttpError, toErrorResponse } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { getStripeClient } from "@/lib/stripe";
import { createPackageSchema, updatePackageSchema } from "@/lib/account-schemas";

export const runtime = "nodejs";

const normalizeCurrency = (value: string) => value.trim().toLowerCase();

type StripePackageSyncInput = {
  name: string;
  slug: string;
  description?: string | null;
  priceCents: number;
  currency: string;
  stripeProductId?: string;
  stripePriceId?: string;
};

const resolveStripeProductId = async ({
  name,
  slug,
  description,
  stripeProductId,
}: Pick<
  StripePackageSyncInput,
  "name" | "slug" | "description" | "stripeProductId"
>) => {
  const stripe = getStripeClient();
  const preferredId = stripeProductId?.trim();

  if (preferredId) {
    try {
      const product = await stripe.products.retrieve(preferredId);
      if ((product as { deleted?: boolean }).deleted) {
        throw new HttpError(400, `Stripe product ${preferredId} is deleted.`);
      }
      return product.id;
    } catch {
      throw new HttpError(400, `Invalid Stripe product ID: ${preferredId}.`);
    }
  }

  let startingAfter: string | undefined;
  while (true) {
    const page = await stripe.products.list({
      active: true,
      limit: 100,
      ...(startingAfter ? { starting_after: startingAfter } : {}),
    });

    const matched = page.data.find((product) => product.metadata?.packageSlug === slug);
    if (matched) {
      return matched.id;
    }

    if (!page.has_more || page.data.length === 0) {
      break;
    }

    startingAfter = page.data[page.data.length - 1]?.id;
  }

  const created = await stripe.products.create({
    name,
    description: description || undefined,
    metadata: {
      packageSlug: slug,
    },
  });

  return created.id;
};

const findExistingPriceForProduct = async ({
  productId,
  priceCents,
  currency,
}: {
  productId: string;
  priceCents: number;
  currency: string;
}) => {
  const stripe = getStripeClient();
  let startingAfter: string | undefined;

  while (true) {
    const page = await stripe.prices.list({
      product: productId,
      active: true,
      limit: 100,
      ...(startingAfter ? { starting_after: startingAfter } : {}),
    });

    const matched = page.data.find(
      (price) =>
        price.type === "one_time" &&
        !price.recurring &&
        price.currency === currency &&
        price.unit_amount === priceCents,
    );

    if (matched) {
      return matched.id;
    }

    if (!page.has_more || page.data.length === 0) {
      return null;
    }

    startingAfter = page.data[page.data.length - 1]?.id;
  }
};

const resolveStripePriceFromProvidedId = async ({
  stripePriceId,
  priceCents,
  currency,
}: {
  stripePriceId: string;
  priceCents: number;
  currency: string;
}) => {
  const stripe = getStripeClient();
  const priceId = stripePriceId.trim();

  try {
    const price = await stripe.prices.retrieve(priceId);

    if (typeof price.product !== "string") {
      throw new HttpError(400, "Provided Stripe price is missing a product reference.");
    }

    const stripeProductId = price.product;
    const isExactOneTimePrice =
      price.active &&
      price.type === "one_time" &&
      !price.recurring &&
      price.unit_amount === priceCents &&
      price.currency === currency;

    if (isExactOneTimePrice) {
      return {
        stripeProductId,
        stripePriceId: price.id,
      };
    }

    const existingPriceId = await findExistingPriceForProduct({
      productId: stripeProductId,
      priceCents,
      currency,
    });

    if (existingPriceId) {
      return {
        stripeProductId,
        stripePriceId: existingPriceId,
      };
    }

    const createdPrice = await stripe.prices.create({
      product: stripeProductId,
      currency,
      unit_amount: priceCents,
    });

    return {
      stripeProductId,
      stripePriceId: createdPrice.id,
    };
  } catch (error) {
    if (error instanceof HttpError) {
      throw error;
    }
    throw new HttpError(400, `Invalid Stripe price ID: ${priceId}.`);
  }
};

const ensureStripePriceForPackage = async (
  input: StripePackageSyncInput,
): Promise<{ stripeProductId: string; stripePriceId: string }> => {
  const stripe = getStripeClient();
  const currency = normalizeCurrency(input.currency);

  if (!/^[a-z]{3}$/.test(currency)) {
    throw new HttpError(400, "Currency must be a valid 3-letter code.");
  }

  if (input.stripePriceId?.trim()) {
    return resolveStripePriceFromProvidedId({
      stripePriceId: input.stripePriceId,
      priceCents: input.priceCents,
      currency,
    });
  }

  const stripeProductId = await resolveStripeProductId({
    name: input.name,
    slug: input.slug,
    description: input.description,
    stripeProductId: input.stripeProductId,
  });

  const existingPriceId = await findExistingPriceForProduct({
    productId: stripeProductId,
    priceCents: input.priceCents,
    currency,
  });

  if (existingPriceId) {
    return {
      stripeProductId,
      stripePriceId: existingPriceId,
    };
  }

  const createdPrice = await stripe.prices.create({
    product: stripeProductId,
    currency,
    unit_amount: input.priceCents,
  });

  return {
    stripeProductId,
    stripePriceId: createdPrice.id,
  };
};

export async function GET(request: Request) {
  try {
    await requireAdminUser(request);
    const packages = await prisma.package.findMany({
      orderBy: [{ createdAt: "desc" }],
    });
    return NextResponse.json({ packages });
  } catch (error) {
    return toErrorResponse(error, "Failed to load packages.");
  }
}

export async function POST(request: Request) {
  try {
    await requireAdminUser(request);
    const body = await request.json();
    const parsed = createPackageSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid package payload.",
          details: parsed.error.flatten(),
        },
        { status: 400 },
      );
    }

    const currency = normalizeCurrency(parsed.data.currency);
    const stripeDetails = await ensureStripePriceForPackage({
      name: parsed.data.name,
      slug: parsed.data.slug,
      description: parsed.data.description,
      priceCents: parsed.data.priceCents,
      currency,
      stripeProductId: parsed.data.stripeProductId,
      stripePriceId: parsed.data.stripePriceId,
    });

    const created = await prisma.package.create({
      data: {
        name: parsed.data.name,
        slug: parsed.data.slug,
        description: parsed.data.description,
        featureList: parsed.data.featureList,
        priceCents: parsed.data.priceCents,
        currency,
        tokenAmount: parsed.data.tokenAmount,
        stripePriceId: stripeDetails.stripePriceId,
        stripeProductId: stripeDetails.stripeProductId,
        isActive: parsed.data.isActive,
      },
    });

    return NextResponse.json({ ok: true, package: created });
  } catch (error) {
    return toErrorResponse(error, "Failed to create package.");
  }
}

export async function PUT(request: Request) {
  try {
    await requireAdminUser(request);
    const body = await request.json();
    const parsed = updatePackageSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid package update payload.",
          details: parsed.error.flatten(),
        },
        { status: 400 },
      );
    }

    const { id, ...rest } = parsed.data;
    const existing = await prisma.package.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new HttpError(404, "Package not found.");
    }

    const updates: Record<string, unknown> = {};

    if (rest.name !== undefined) updates.name = rest.name;
    if (rest.slug !== undefined) updates.slug = rest.slug;
    if (rest.description !== undefined) updates.description = rest.description;
    if (rest.featureList !== undefined) updates.featureList = rest.featureList;
    if (rest.priceCents !== undefined) updates.priceCents = rest.priceCents;
    if (rest.currency !== undefined) updates.currency = rest.currency.toLowerCase();
    if (rest.tokenAmount !== undefined) updates.tokenAmount = rest.tokenAmount;
    if (rest.stripePriceId !== undefined) updates.stripePriceId = rest.stripePriceId;
    if (rest.stripeProductId !== undefined) updates.stripeProductId = rest.stripeProductId;
    if (rest.isActive !== undefined) updates.isActive = rest.isActive;

    const nextName = rest.name ?? existing.name;
    const nextSlug = rest.slug ?? existing.slug;
    const nextDescription = rest.description ?? existing.description;
    const nextPriceCents = rest.priceCents ?? existing.priceCents;
    const nextCurrency = normalizeCurrency(rest.currency ?? existing.currency);
    const nextStripePriceId =
      rest.stripePriceId !== undefined ? rest.stripePriceId : existing.stripePriceId || undefined;
    const nextStripeProductId =
      rest.stripeProductId !== undefined
        ? rest.stripeProductId
        : existing.stripeProductId || undefined;

    const shouldSyncStripe =
      rest.name !== undefined ||
      rest.slug !== undefined ||
      rest.description !== undefined ||
      rest.priceCents !== undefined ||
      rest.currency !== undefined ||
      rest.stripePriceId !== undefined ||
      rest.stripeProductId !== undefined ||
      !existing.stripePriceId ||
      !existing.stripeProductId;

    if (shouldSyncStripe) {
      const stripeDetails = await ensureStripePriceForPackage({
        name: nextName,
        slug: nextSlug,
        description: nextDescription,
        priceCents: nextPriceCents,
        currency: nextCurrency,
        stripePriceId: nextStripePriceId,
        stripeProductId: nextStripeProductId,
      });

      updates.stripeProductId = stripeDetails.stripeProductId;
      updates.stripePriceId = stripeDetails.stripePriceId;
      updates.currency = nextCurrency;
    }

    const updated = await prisma.package.update({
      where: { id },
      data: updates,
    });

    return NextResponse.json({ ok: true, package: updated });
  } catch (error) {
    return toErrorResponse(error, "Failed to update package.");
  }
}

export async function DELETE(request: Request) {
  try {
    await requireAdminUser(request);
    const body = (await request.json().catch(() => null)) as { id?: unknown } | null;
    const packageId = typeof body?.id === "string" ? body.id.trim() : "";

    if (!packageId) {
      throw new HttpError(400, "Package id is required.");
    }

    const existing = await prisma.package.findUnique({
      where: { id: packageId },
      select: {
        id: true,
        name: true,
      },
    });

    if (!existing) {
      throw new HttpError(404, "Package not found.");
    }

    const purchaseCount = await prisma.packagePurchase.count({
      where: {
        packageId,
      },
    });

    if (purchaseCount > 0) {
      throw new HttpError(
        409,
        "Cannot delete this package because it has purchase history. Set it inactive instead.",
      );
    }

    await prisma.package.delete({
      where: { id: packageId },
    });

    return NextResponse.json({
      ok: true,
      deletedId: packageId,
      message: `Package "${existing.name}" deleted.`,
    });
  } catch (error) {
    return toErrorResponse(error, "Failed to delete package.");
  }
}
