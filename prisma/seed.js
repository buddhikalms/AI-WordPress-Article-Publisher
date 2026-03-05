/* eslint-disable no-console */
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const packages = [
  {
    name: "Starter",
    slug: "starter",
    description: "Best for testing and light usage.",
    featureList: ["Email support", "Core generation tools"],
    priceCents: 1900,
    currency: "usd",
    tokenAmount: 50,
    isActive: true,
  },
  {
    name: "Growth",
    slug: "growth",
    description: "For regular content operations.",
    featureList: ["Priority queue", "Advanced publishing", "Email support"],
    priceCents: 6900,
    currency: "usd",
    tokenAmount: 250,
    isActive: true,
  },
  {
    name: "Scale",
    slug: "scale",
    description: "High-volume article generation and publishing.",
    featureList: ["Higher throughput", "Priority support", "Bulk workflows"],
    priceCents: 14900,
    currency: "usd",
    tokenAmount: 700,
    isActive: true,
  },
];

async function main() {
  for (const pkg of packages) {
    await prisma.package.upsert({
      where: { slug: pkg.slug },
      create: pkg,
      update: {
        name: pkg.name,
        description: pkg.description,
        featureList: pkg.featureList,
        priceCents: pkg.priceCents,
        currency: pkg.currency,
        tokenAmount: pkg.tokenAmount,
        isActive: pkg.isActive,
      },
    });
  }

  console.log("Seed complete.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });