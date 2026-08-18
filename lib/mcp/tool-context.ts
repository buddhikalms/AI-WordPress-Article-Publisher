import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import { HttpError } from "@/lib/errors";
import { checkRateLimit } from "@/lib/mcp/rate-limit";
import { logMcpActivity } from "@/lib/mcp/log-activity";

export interface ToolAuthContext {
  userId: string;
  clientId: string;
}

export interface ToolExtra {
  authInfo?: AuthInfo;
}

const getToolAuthContext = (extra: ToolExtra): ToolAuthContext => {
  const userId = extra.authInfo?.extra?.userId;
  const clientId = extra.authInfo?.clientId;
  if (typeof userId !== "string" || !userId || !clientId) {
    throw new HttpError(401, "Missing authenticated MCP context.");
  }
  return { userId, clientId };
};

const toErrorSummary = (error: unknown) => {
  if (error instanceof HttpError) {
    return `${error.status}: ${error.message}`;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "Unknown error.";
};

const toErrorMessage = (error: unknown) => {
  if (error instanceof HttpError || error instanceof Error) {
    return error.message;
  }
  return "Unexpected error.";
};

const textResult = (value: unknown, isError = false) => ({
  content: [{ type: "text" as const, text: typeof value === "string" ? value : JSON.stringify(value, null, 2) }],
  isError,
});

// Every tool handler goes through this: resolves the authenticated user from
// the MCP AuthInfo, enforces the per-user rate limit, runs the handler, and
// writes exactly one McpActivityLog row for the call (success or failure).
// Never pass raw error bodies or secrets into the logged errorSummary.
export const runTool = async (params: {
  extra: ToolExtra;
  tool: string;
  action: string;
  siteId?: string;
  fn: (ctx: ToolAuthContext) => Promise<{
    data: unknown;
    wordpressPostId?: number;
    tokensSpent?: number;
  }>;
}) => {
  let ctx: ToolAuthContext;
  try {
    ctx = getToolAuthContext(params.extra);
  } catch (error) {
    return textResult(toErrorMessage(error), true);
  }

  if (!checkRateLimit(ctx.userId)) {
    await logMcpActivity({
      userId: ctx.userId,
      clientId: ctx.clientId,
      tool: params.tool,
      action: params.action,
      success: false,
      siteId: params.siteId,
      errorSummary: "rate_limited",
    });
    return textResult("Rate limit exceeded. Please slow down and try again shortly.", true);
  }

  try {
    const { data, wordpressPostId, tokensSpent } = await params.fn(ctx);
    await logMcpActivity({
      userId: ctx.userId,
      clientId: ctx.clientId,
      tool: params.tool,
      action: params.action,
      success: true,
      siteId: params.siteId,
      wordpressPostId,
      tokensSpent,
    });
    return textResult(data);
  } catch (error) {
    await logMcpActivity({
      userId: ctx.userId,
      clientId: ctx.clientId,
      tool: params.tool,
      action: params.action,
      success: false,
      siteId: params.siteId,
      errorSummary: toErrorSummary(error),
    });
    return textResult(toErrorMessage(error), true);
  }
};
