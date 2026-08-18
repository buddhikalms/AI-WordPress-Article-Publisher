import { prisma } from "@/lib/prisma";

export const logMcpActivity = async (params: {
  userId: string;
  clientId?: string;
  tool: string;
  action: string;
  success: boolean;
  requestId?: string;
  siteId?: string;
  wordpressPostId?: number;
  tokensSpent?: number;
  errorSummary?: string;
}) => {
  try {
    await prisma.mcpActivityLog.create({
      data: {
        userId: params.userId,
        clientId: params.clientId,
        tool: params.tool,
        action: params.action,
        success: params.success,
        requestId: params.requestId,
        siteId: params.siteId,
        wordpressPostId: params.wordpressPostId,
        tokensSpent: params.tokensSpent,
        errorSummary: params.errorSummary?.slice(0, 2000),
      },
    });
  } catch (error) {
    // Never let logging failures break a tool response. Never log secrets
    // here either — this only ever receives short status summaries.
    console.error("Failed to write MCP activity log", error);
  }
};
