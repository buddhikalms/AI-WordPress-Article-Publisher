import { hash } from "bcryptjs";
import { NextResponse } from "next/server";
import { registerUserSchema } from "@/lib/account-schemas";
import { toErrorResponse, HttpError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { encryptSecret } from "@/lib/crypto";
import { issueVerificationCode } from "@/lib/email-verification";

export const runtime = "nodejs";

const getDefaultSiteName = (baseUrl: string) => {
  try {
    return new URL(baseUrl).hostname.replace(/^www\./, "");
  } catch {
    return "Primary site";
  }
};

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = registerUserSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid registration payload.",
          details: parsed.error.flatten(),
        },
        { status: 400 },
      );
    }

    const payload = parsed.data;
    const email = payload.email.toLowerCase();
    const existingUser = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });

    if (existingUser) {
      throw new HttpError(409, "An account already exists for this email.");
    }

    const passwordHash = await hash(payload.password, 12);

    const created = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          name: payload.name,
          email,
          passwordHash,
        },
      });

      if (
        payload.wordpressBaseUrl &&
        payload.wordpressUsername &&
        payload.wordpressPassword
      ) {
        await tx.wordPressCredential.create({
          data: {
            userId: user.id,
            name: getDefaultSiteName(payload.wordpressBaseUrl),
            baseUrl: payload.wordpressBaseUrl.trim().replace(/\/+$/, ""),
            username: payload.wordpressUsername.trim(),
            appPasswordEncrypted: encryptSecret(payload.wordpressPassword),
            isDefault: true,
          },
        });
      }

      return user;
    });

    await issueVerificationCode({
      userId: created.id,
      email,
      name: created.name,
    });

    return NextResponse.json({
      ok: true,
      message: "Registration complete. Check your email for the verification code.",
    });
  } catch (error) {
    return toErrorResponse(error, "Registration failed.");
  }
}
