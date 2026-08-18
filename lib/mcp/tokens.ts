import { createHash, randomBytes } from "crypto";

export const generateOpaqueToken = () => randomBytes(32).toString("base64url");

export const hashToken = (token: string) =>
  createHash("sha256").update(token).digest("hex");

export const generateClientId = () => `mcp_${randomBytes(16).toString("hex")}`;
