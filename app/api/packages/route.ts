import { NextResponse } from "next/server";
import { toErrorResponse } from "@/lib/errors";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET() {
  try {
    const packages = await prisma.package.findMany({
      where: {
        isActive: true,
      },
      orderBy: [
        {
          priceCents: "asc",
        },
      ],
    });

    return NextResponse.json({ packages });
  } catch (error) {
    return toErrorResponse(error, "Failed to load packages.");
  }
}