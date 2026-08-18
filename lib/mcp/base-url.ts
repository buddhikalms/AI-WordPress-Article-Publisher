import { HttpError } from "@/lib/errors";

export const getMcpBaseUrl = () => {
  const base =
    process.env.APP_URL || process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL;
  if (!base) {
    throw new HttpError(
      500,
      "APP_URL (or NEXTAUTH_URL) must be configured to run the MCP OAuth server.",
    );
  }
  return base.trim().replace(/\/+$/, "");
};
