import { prisma } from "@/lib/prisma";

export const findOAuthClient = (clientId: string) =>
  prisma.mcpOAuthClient.findUnique({ where: { clientId } });

export const isRedirectUriRegistered = (
  client: { redirectUris: unknown },
  redirectUri: string,
) => {
  if (!Array.isArray(client.redirectUris)) {
    return false;
  }
  return client.redirectUris.some(
    (uri) => typeof uri === "string" && uri === redirectUri,
  );
};

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

export const isAllowedRedirectUri = (value: string) => {
  try {
    const url = new URL(value);
    if (url.protocol === "https:") {
      return true;
    }
    if (url.protocol === "http:" && LOOPBACK_HOSTS.has(url.hostname)) {
      return true;
    }
    return false;
  } catch {
    return false;
  }
};
