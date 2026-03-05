import { NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/auth-session";
import { toErrorResponse } from "@/lib/errors";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await requireAdminUser(request);

    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        emailVerified: true,
        tokenBalance: true,
        createdAt: true,
        deviceRegistration: {
          select: {
            deviceId: true,
            lastSeenAt: true,
          },
        },
        wordpressSites: {
          select: {
            id: true,
            name: true,
            baseUrl: true,
            username: true,
            updatedAt: true,
            isDefault: true,
          },
          orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }],
        },
        _count: {
          select: {
            wordpressSites: true,
          },
        },
        packagePurchases: {
          where: {
            status: "PAID",
          },
          orderBy: {
            createdAt: "desc",
          },
          take: 3,
          select: {
            id: true,
            amountCents: true,
            currency: true,
            tokensGranted: true,
            createdAt: true,
            package: {
              select: {
                name: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json({ users });
  } catch (error) {
    return toErrorResponse(error, "Failed to load users.");
  }
}
