import { NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/auth-session";
import { toErrorResponse } from "@/lib/errors";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await requireAdminUser(request);

    const url = new URL(request.url);
    const userId = url.searchParams.get("userId") || undefined;
    const tool = url.searchParams.get("tool") || undefined;
    const limit = Math.min(
      Math.max(Number(url.searchParams.get("limit")) || 50, 1),
      200,
    );

    const logs = await prisma.mcpActivityLog.findMany({
      where: {
        userId,
        tool,
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true,
        userId: true,
        clientId: true,
        tool: true,
        action: true,
        success: true,
        siteId: true,
        wordpressPostId: true,
        tokensSpent: true,
        errorSummary: true,
        createdAt: true,
        user: {
          select: { email: true, name: true },
        },
      },
    });

    return NextResponse.json({ logs });
  } catch (error) {
    return toErrorResponse(error, "Failed to load MCP activity logs.");
  }
}
