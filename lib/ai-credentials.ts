import { decryptSecret, encryptSecret } from "@/lib/crypto";
import { HttpError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";

export type AiCredentialProvider = "openai" | "gemini";
export type AiCredentialOwnerType = "user" | "platform";

export const aiCredentialProviders: AiCredentialProvider[] = ["openai", "gemini"];

const providerLabels: Record<AiCredentialProvider, string> = {
  openai: "OpenAI",
  gemini: "Gemini",
};

const defaultModels: Record<AiCredentialProvider, string> = {
  openai: process.env.OPENAI_TEXT_MODEL || "gpt-4.1-mini",
  gemini: process.env.GEMINI_TEXT_MODEL || "gemini-3.5-flash",
};

const envApiKeys: Record<AiCredentialProvider, string | undefined> = {
  openai: process.env.OPENAI_API_KEY,
  gemini: process.env.GEMINI_API_KEY,
};

const getOwnerScope = (ownerType: AiCredentialOwnerType, userId?: string) => {
  if (ownerType === "user") {
    if (!userId) throw new HttpError(401, "User account is required.");
    return { ownerType, ownerId: userId };
  }
  return { ownerType, ownerId: "platform" };
};

const maskSecret = (value?: string | null) => {
  if (!value) return null;
  if (value.length <= 8) return "••••";
  return `${value.slice(0, 4)}••••${value.slice(-4)}`;
};

export const listAiProviderCredentials = async (params: {
  ownerType: AiCredentialOwnerType;
  userId?: string;
}) => {
  const scope = getOwnerScope(params.ownerType, params.userId);
  const rows = await prisma.aiProviderCredential.findMany({
    where: scope,
    orderBy: [{ provider: "asc" }],
  });
  const byProvider = new Map(rows.map((row) => [row.provider, row]));

  return aiCredentialProviders.map((provider) => {
    const row = byProvider.get(provider);
    return {
      provider,
      label: providerLabels[provider],
      hasApiKey: Boolean(row?.apiKeyEncrypted),
      maskedApiKey: row?.apiKeyEncrypted ? maskSecret(decryptSecret(row.apiKeyEncrypted)) : null,
      defaultModel: row?.defaultModel || defaultModels[provider],
      isEnabled: row?.isEnabled ?? false,
      updatedAt: row?.updatedAt?.toISOString() || null,
      envAvailable: Boolean(envApiKeys[provider]),
    };
  });
};

export const saveAiProviderCredential = async (params: {
  ownerType: AiCredentialOwnerType;
  userId?: string;
  provider: AiCredentialProvider;
  apiKey?: string;
  defaultModel?: string;
  isEnabled: boolean;
}) => {
  const scope = getOwnerScope(params.ownerType, params.userId);
  const existing = await prisma.aiProviderCredential.findUnique({
    where: {
      ownerType_ownerId_provider: {
        ...scope,
        provider: params.provider,
      },
    },
  });

  if (!existing && !params.apiKey?.trim()) {
    throw new HttpError(400, "API key is required when adding a provider credential.");
  }

  const data = {
    defaultModel: params.defaultModel?.trim() || defaultModels[params.provider],
    isEnabled: params.isEnabled,
    ...(params.apiKey?.trim()
      ? { apiKeyEncrypted: encryptSecret(params.apiKey.trim()) }
      : {}),
  };

  return prisma.aiProviderCredential.upsert({
    where: {
      ownerType_ownerId_provider: {
        ...scope,
        provider: params.provider,
      },
    },
    create: {
      ...scope,
      provider: params.provider,
      apiKeyEncrypted: data.apiKeyEncrypted || encryptSecret(params.apiKey?.trim() || ""),
      defaultModel: data.defaultModel,
      isEnabled: data.isEnabled,
    },
    update: data,
  });
};

export const deleteAiProviderCredential = async (params: {
  ownerType: AiCredentialOwnerType;
  userId?: string;
  provider: AiCredentialProvider;
}) => {
  const scope = getOwnerScope(params.ownerType, params.userId);
  await prisma.aiProviderCredential.deleteMany({
    where: { ...scope, provider: params.provider },
  });
};

export const resolveAiProviderCredential = async (params: {
  userId: string;
  provider: "openai" | "gemini" | "ollama";
  requestedModel?: string;
}) => {
  if (params.provider === "ollama") {
    return { model: params.requestedModel };
  }

  const provider = params.provider as AiCredentialProvider;
  const [userCredential, platformCredential] = await Promise.all([
    prisma.aiProviderCredential.findUnique({
      where: {
        ownerType_ownerId_provider: {
          ownerType: "user",
          ownerId: params.userId,
          provider,
        },
      },
    }),
    prisma.aiProviderCredential.findUnique({
      where: {
        ownerType_ownerId_provider: {
          ownerType: "platform",
          ownerId: "platform",
          provider,
        },
      },
    }),
  ]);

  const credential =
    userCredential?.isEnabled && userCredential.apiKeyEncrypted
      ? userCredential
      : platformCredential?.isEnabled && platformCredential.apiKeyEncrypted
      ? platformCredential
      : null;

  return {
    apiKey: credential?.apiKeyEncrypted ? decryptSecret(credential.apiKeyEncrypted) : undefined,
    model: params.requestedModel?.trim() || credential?.defaultModel || undefined,
  };
};