import { createHash, randomInt } from "crypto";
import { prisma } from "@/lib/prisma";
import { sendVerificationCodeEmail } from "@/lib/mailer";
import { HttpError } from "@/lib/errors";

const CODE_TTL_MINUTES = 15;

const hashCode = (code: string) =>
  createHash("sha256").update(code).digest("hex");

const generateCode = () => String(randomInt(100000, 1000000));

export const issueVerificationCode = async (params: {
  userId: string;
  email: string;
  name?: string | null;
}) => {
  const code = generateCode();
  const codeHash = hashCode(code);
  const expiresAt = new Date(Date.now() + CODE_TTL_MINUTES * 60 * 1000);

  await prisma.$transaction(async (tx) => {
    await tx.emailVerificationCode.deleteMany({
      where: {
        userId: params.userId,
        consumedAt: null,
      },
    });

    await tx.emailVerificationCode.create({
      data: {
        userId: params.userId,
        email: params.email,
        codeHash,
        expiresAt,
      },
    });
  });

  await sendVerificationCodeEmail({
    email: params.email,
    name: params.name,
    code,
  });
};

export const verifyEmailCode = async (params: { email: string; code: string }) => {
  const email = params.email.trim().toLowerCase();
  const codeHash = hashCode(params.code);

  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      emailVerified: true,
    },
  });

  if (!user) {
    throw new HttpError(404, "No account found for that email.");
  }

  if (user.emailVerified) {
    return;
  }

  const record = await prisma.emailVerificationCode.findFirst({
    where: {
      userId: user.id,
      email,
      codeHash,
      consumedAt: null,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  if (!record) {
    throw new HttpError(400, "Invalid verification code.");
  }

  if (record.expiresAt < new Date()) {
    throw new HttpError(400, "Verification code has expired.");
  }

  await prisma.$transaction(async (tx) => {
    await tx.emailVerificationCode.update({
      where: { id: record.id },
      data: { consumedAt: new Date() },
    });

    await tx.user.update({
      where: { id: user.id },
      data: { emailVerified: new Date() },
    });
  });
};