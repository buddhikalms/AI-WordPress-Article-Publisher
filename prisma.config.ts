import { existsSync, readFileSync } from "fs";
import { resolve } from "path";
import { defineConfig } from "prisma/config";

const loadEnvFile = () => {
  const envPath = resolve(process.cwd(), ".env");
  if (!existsSync(envPath)) {
    return;
  }

  const content = readFileSync(envPath, "utf8");
  const lines = content.split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const equalsIndex = trimmed.indexOf("=");
    if (equalsIndex <= 0) {
      continue;
    }

    const key = trimmed.slice(0, equalsIndex).trim();
    const rawValue = trimmed.slice(equalsIndex + 1).trim();

    if (!key || process.env[key] !== undefined) {
      continue;
    }

    const value = rawValue.replace(/^['\"]|['\"]$/g, "");
    process.env[key] = value;
  }
};

loadEnvFile();

const datasource = process.env.DATABASE_URL
  ? {
      url: process.env.DATABASE_URL,
    }
  : undefined;

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  ...(datasource ? { datasource } : {}),
});
