import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";
import { HttpError } from "@/lib/errors";

const ALGORITHM = "aes-256-gcm";

const getEncryptionKey = () => {
  const raw = process.env.APP_ENCRYPTION_KEY;
  if (!raw) {
    throw new HttpError(
      500,
      "APP_ENCRYPTION_KEY is missing. Configure a 32-byte key for credential encryption.",
    );
  }

  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    return Buffer.from(raw, "hex");
  }

  try {
    const decoded = Buffer.from(raw, "base64");
    if (decoded.length === 32) {
      return decoded;
    }
  } catch {
    // Fall through to deterministic hash derivation.
  }

  return createHash("sha256").update(raw).digest();
};

export const encryptSecret = (plainText: string) => {
  const key = getEncryptionKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([
    cipher.update(plainText, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return `${iv.toString("hex")}:${tag.toString("hex")}:${encrypted.toString("hex")}`;
};

export const decryptSecret = (encryptedValue: string) => {
  const [ivHex, tagHex, ciphertextHex] = encryptedValue.split(":");
  if (!ivHex || !tagHex || !ciphertextHex) {
    throw new HttpError(500, "Stored secret has invalid format.");
  }

  const key = getEncryptionKey();
  const decipher = createDecipheriv(
    ALGORITHM,
    key,
    Buffer.from(ivHex, "hex"),
  );
  decipher.setAuthTag(Buffer.from(tagHex, "hex"));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(ciphertextHex, "hex")),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
};