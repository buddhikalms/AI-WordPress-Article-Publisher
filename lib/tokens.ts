import type { Prisma } from "@prisma/client";
import { TokenReason, UsageAction } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { HttpError } from "@/lib/errors";

export const TOKEN_COSTS: Record<UsageAction, number> = {
  ARTICLE_GENERATION: 5,
  IMAGE_GENERATION: 2,
  PUBLISH_POST: 1,
};

export const creditTokens = async (params: {
  userId: string;
  amount: number;
  reason?: TokenReason;
  description?: string;
  referenceType?: string;
  referenceId?: string;
}) => {
  if (!Number.isInteger(params.amount) || params.amount <= 0) {
    throw new HttpError(400, "Token credit amount must be a positive integer.");
  }

  return prisma.$transaction(async (tx) => {
    const updatedUser = await tx.user.update({
      where: { id: params.userId },
      data: {
        tokenBalance: {
          increment: params.amount,
        },
      },
      select: {
        id: true,
        tokenBalance: true,
      },
    });

    await tx.tokenTransaction.create({
      data: {
        userId: params.userId,
        amount: params.amount,
        balanceAfter: updatedUser.tokenBalance,
        reason: params.reason || TokenReason.PACKAGE_PURCHASE,
        description: params.description,
        referenceType: params.referenceType,
        referenceId: params.referenceId,
      },
    });

    return updatedUser.tokenBalance;
  });
};

export const consumeTokens = async (params: {
  userId: string;
  amount: number;
  reason: TokenReason;
  action: UsageAction;
  description?: string;
  metadata?: Prisma.InputJsonValue;
  requestId?: string;
  referenceType?: string;
  referenceId?: string;
}) => {
  if (!Number.isInteger(params.amount) || params.amount <= 0) {
    throw new HttpError(400, "Token debit amount must be a positive integer.");
  }

  return prisma.$transaction(async (tx) => {
    if (params.requestId) {
      const existingUsage = await tx.generationUsage.findUnique({
        where: { requestId: params.requestId },
        select: {
          id: true,
          userId: true,
        },
      });

      if (existingUsage && existingUsage.userId === params.userId) {
        const user = await tx.user.findUnique({
          where: { id: params.userId },
          select: { tokenBalance: true },
        });

        return {
          charged: false,
          tokenBalance: user?.tokenBalance ?? 0,
        };
      }
    }

    const updated = await tx.user.updateMany({
      where: {
        id: params.userId,
        tokenBalance: {
          gte: params.amount,
        },
      },
      data: {
        tokenBalance: {
          decrement: params.amount,
        },
      },
    });

    if (updated.count === 0) {
      throw new HttpError(402, "Insufficient tokens. Please purchase a package.");
    }

    const user = await tx.user.findUnique({
      where: { id: params.userId },
      select: {
        tokenBalance: true,
      },
    });

    if (!user) {
      throw new HttpError(404, "User not found while charging tokens.");
    }

    await tx.tokenTransaction.create({
      data: {
        userId: params.userId,
        amount: -params.amount,
        balanceAfter: user.tokenBalance,
        reason: params.reason,
        description: params.description,
        referenceType: params.referenceType,
        referenceId: params.referenceId,
      },
    });

    await tx.generationUsage.create({
      data: {
        userId: params.userId,
        action: params.action,
        tokensSpent: params.amount,
        requestId: params.requestId,
        metadata: params.metadata,
      },
    });

    return {
      charged: true,
      tokenBalance: user.tokenBalance,
    };
  });
};

export const debitTokens = async (params: {
  userId: string;
  amount: number;
  reason?: TokenReason;
  description?: string;
  referenceType?: string;
  referenceId?: string;
}) => {
  if (!Number.isInteger(params.amount) || params.amount <= 0) {
    throw new HttpError(400, "Token debit amount must be a positive integer.");
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.user.updateMany({
      where: {
        id: params.userId,
        tokenBalance: {
          gte: params.amount,
        },
      },
      data: {
        tokenBalance: {
          decrement: params.amount,
        },
      },
    });

    if (updated.count === 0) {
      throw new HttpError(402, "Insufficient tokens for this adjustment.");
    }

    const user = await tx.user.findUnique({
      where: { id: params.userId },
      select: { tokenBalance: true },
    });

    if (!user) {
      throw new HttpError(404, "User not found while debiting tokens.");
    }

    await tx.tokenTransaction.create({
      data: {
        userId: params.userId,
        amount: -params.amount,
        balanceAfter: user.tokenBalance,
        reason: params.reason || TokenReason.ADMIN_ADJUSTMENT,
        description: params.description,
        referenceType: params.referenceType,
        referenceId: params.referenceId,
      },
    });

    return user.tokenBalance;
  });
};
