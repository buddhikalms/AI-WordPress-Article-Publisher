import { PrismaClient } from "@prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { HttpError } from "@/lib/errors";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  prismaAdapter?: PrismaMariaDb;
};

const parseOptionalBoolean = (value: string | null | undefined) => {
  if (value === null || value === undefined || value.trim() === "") {
    return undefined;
  }

  return value.toLowerCase() === "true";
};

const getMariaDbAdapter = () => {
  if (globalForPrisma.prismaAdapter) {
    return globalForPrisma.prismaAdapter;
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new HttpError(500, "DATABASE_URL is missing.");
  }

  let parsed: URL;
  try {
    parsed = new URL(databaseUrl);
  } catch {
    throw new HttpError(500, "DATABASE_URL is invalid.");
  }

  const database = parsed.pathname.replace(/^\/+/, "");
  if (!database) {
    throw new HttpError(500, "DATABASE_URL must include a database name.");
  }

  const isLocalHost = ["localhost", "127.0.0.1", "::1"].includes(parsed.hostname);
  const allowPublicKeyRetrieval =
    parseOptionalBoolean(parsed.searchParams.get("allowPublicKeyRetrieval")) ??
    parseOptionalBoolean(process.env.MYSQL_ALLOW_PUBLIC_KEY_RETRIEVAL) ??
    isLocalHost;

  const adapter = new PrismaMariaDb({
    host: parsed.hostname,
    port: parsed.port ? Number(parsed.port) : 3306,
    user: decodeURIComponent(parsed.username),
    password: decodeURIComponent(parsed.password),
    database,
    allowPublicKeyRetrieval,
  });

  if (process.env.NODE_ENV !== "production") {
    globalForPrisma.prismaAdapter = adapter;
  }

  return adapter;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter: getMariaDbAdapter(),
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
