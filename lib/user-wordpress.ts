import { prisma } from "@/lib/prisma";
import { HttpError } from "@/lib/errors";
import { decryptSecret, encryptSecret } from "@/lib/crypto";

const normalizeBaseUrl = (value: string) => value.trim().replace(/\/+$/, "");
type WordPressCredentialClient = Pick<typeof prisma, "wordPressCredential">;

const siteSummarySelect = {
  id: true,
  name: true,
  baseUrl: true,
  username: true,
  updatedAt: true,
  isDefault: true,
} as const;

const setDefaultSiteInTransaction = async (
  tx: WordPressCredentialClient,
  userId: string,
  siteId: string,
) => {
  await tx.wordPressCredential.updateMany({
    where: {
      userId,
    },
    data: {
      isDefault: false,
    },
  });

  await tx.wordPressCredential.update({
    where: {
      id: siteId,
    },
    data: {
      isDefault: true,
    },
  });
};

export const listWordPressCredentialSummaries = async (userId: string) =>
  prisma.wordPressCredential.findMany({
    where: {
      userId,
    },
    select: siteSummarySelect,
    orderBy: [{ isDefault: "desc" }, { name: "asc" }],
  });

export const getDefaultWordPressCredentialSummary = async (userId: string) =>
  prisma.wordPressCredential.findFirst({
    where: {
      userId,
    },
    select: siteSummarySelect,
    orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }],
  });

export const getWordPressCredentialSummary = getDefaultWordPressCredentialSummary;

export const getUserWordPressConfig = async (userId: string, siteId?: string) => {
  const credential = siteId
    ? await prisma.wordPressCredential.findFirst({
        where: {
          id: siteId,
          userId,
        },
      })
    : await prisma.wordPressCredential.findFirst({
        where: {
          userId,
        },
        orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }],
      });

  if (!credential) {
    throw new HttpError(
      400,
      "No WordPress site is configured for this account.",
    );
  }

  return {
    id: credential.id,
    name: credential.name,
    baseUrl: credential.baseUrl,
    username: credential.username,
    appPassword: decryptSecret(credential.appPasswordEncrypted),
  };
};

export const saveUserWordPressConfig = async (params: {
  userId: string;
  siteId?: string;
  name: string;
  baseUrl: string;
  username: string;
  appPassword?: string;
  isDefault?: boolean;
}) => {
  if (!params.name.trim() || !params.baseUrl.trim() || !params.username.trim()) {
    throw new HttpError(
      400,
      "Site name, WordPress base URL, and username are required.",
    );
  }

  return prisma.$transaction(async (tx) => {
    const existing = params.siteId
      ? await tx.wordPressCredential.findFirst({
          where: {
            id: params.siteId,
            userId: params.userId,
          },
        })
      : null;

    if (params.siteId && !existing) {
      throw new HttpError(404, "The selected WordPress site was not found.");
    }

    if (!existing && !params.appPassword?.trim()) {
      throw new HttpError(
        400,
        "A WordPress app password is required when adding a new site.",
      );
    }

    const existingCount = await tx.wordPressCredential.count({
      where: {
        userId: params.userId,
      },
    });

    const saved = existing
      ? await tx.wordPressCredential.update({
          where: {
            id: existing.id,
          },
          data: {
            name: params.name.trim(),
            baseUrl: normalizeBaseUrl(params.baseUrl),
            username: params.username.trim(),
            appPasswordEncrypted: params.appPassword?.trim()
              ? encryptSecret(params.appPassword.trim())
              : existing.appPasswordEncrypted,
            isDefault:
              params.isDefault === undefined ? existing.isDefault : params.isDefault,
          },
        })
      : await tx.wordPressCredential.create({
          data: {
            userId: params.userId,
            name: params.name.trim(),
            baseUrl: normalizeBaseUrl(params.baseUrl),
            username: params.username.trim(),
            appPasswordEncrypted: encryptSecret(params.appPassword!.trim()),
            isDefault: params.isDefault || existingCount === 0,
          },
        });

    if (saved.isDefault) {
      await setDefaultSiteInTransaction(tx, params.userId, saved.id);
    } else {
      const currentDefault = await tx.wordPressCredential.findFirst({
        where: {
          userId: params.userId,
          isDefault: true,
        },
        select: {
          id: true,
        },
      });

      if (!currentDefault) {
        await setDefaultSiteInTransaction(tx, params.userId, saved.id);
      }
    }

    return tx.wordPressCredential.findUniqueOrThrow({
      where: {
        id: saved.id,
      },
      select: siteSummarySelect,
    });
  });
};

export const setDefaultWordPressSite = async (params: {
  userId: string;
  siteId: string;
}) =>
  prisma.$transaction(async (tx) => {
    const site = await tx.wordPressCredential.findFirst({
      where: {
        id: params.siteId,
        userId: params.userId,
      },
      select: {
        id: true,
      },
    });

    if (!site) {
      throw new HttpError(404, "The selected WordPress site was not found.");
    }

    await setDefaultSiteInTransaction(tx, params.userId, params.siteId);

    return tx.wordPressCredential.findUniqueOrThrow({
      where: {
        id: params.siteId,
      },
      select: siteSummarySelect,
    });
  });

export const deleteWordPressSite = async (params: {
  userId: string;
  siteId: string;
}) =>
  prisma.$transaction(async (tx) => {
    const site = await tx.wordPressCredential.findFirst({
      where: {
        id: params.siteId,
        userId: params.userId,
      },
    });

    if (!site) {
      throw new HttpError(404, "The selected WordPress site was not found.");
    }

    await tx.wordPressCredential.delete({
      where: {
        id: site.id,
      },
    });

    if (site.isDefault) {
      const nextSite = await tx.wordPressCredential.findFirst({
        where: {
          userId: params.userId,
        },
        orderBy: [{ updatedAt: "desc" }],
        select: {
          id: true,
        },
      });

      if (nextSite) {
        await setDefaultSiteInTransaction(tx, params.userId, nextSite.id);
      }
    }

    return {
      id: site.id,
      name: site.name,
    };
  });
