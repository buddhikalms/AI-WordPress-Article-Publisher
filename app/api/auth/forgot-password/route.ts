import { hash } from "bcryptjs";
import { NextResponse } from "next/server";
import { forgotPasswordSchema } from "@/lib/account-schemas";
import { sendPasswordResetCodeEmail } from "@/lib/mailer";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
const generic = "If an account exists for that email, a reset code has been sent.";

export async function POST(request: Request) {
  const parsed = forgotPasswordSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  const email = parsed.data.email.toLowerCase();
  const user = await prisma.user.findUnique({ where: { email }, select: { id: true, name: true } });
  if (!user) return NextResponse.json({ ok: true, message: generic });

  const code = String(Math.floor(100000 + Math.random() * 900000));
  await prisma.passwordResetCode.create({ data: { userId: user.id, email, codeHash: await hash(code, 10), expiresAt: new Date(Date.now() + 15 * 60 * 1000) } });
  await sendPasswordResetCodeEmail({ email, name: user.name, code });
  return NextResponse.json({ ok: true, message: generic });
}
