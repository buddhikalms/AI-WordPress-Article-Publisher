import { NextResponse } from "next/server";
import { requireSessionUser } from "@/lib/auth-session";
import { toErrorResponse } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import {
  getDefaultWordPressCredentialSummary,
  listWordPressCredentialSummaries,
} from "@/lib/user-wordpress";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const user = await requireSessionUser(request);
    const [wordpressSites, defaultWordpressSite, purchases] = await Promise.all([
      listWordPressCredentialSummaries(user.id),
      getDefaultWordPressCredentialSummary(user.id),
      prisma.packagePurchase.findMany({
        where: {
          userId: user.id,
          status: "PAID",
        },
        include: {
          package: {
            select: {
              id: true,
              name: true,
              tokenAmount: true,
              priceCents: true,
              currency: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
        take: 10,
      }),
    ]);

    return NextResponse.json({
      user,
      wordpress: defaultWordpressSite,
      defaultWordpressSite,
      wordpressSites,
      purchases,
    });
  } catch (error) {
    return toErrorResponse(error, "Failed to load account details.");
  }
}
