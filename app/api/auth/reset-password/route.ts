import { compare, hash } from "bcryptjs";
import { NextResponse } from "next/server";
import { resetPasswordSchema } from "@/lib/account-schemas";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export async function POST(request: Request) {
  const parsed = resetPasswordSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid reset request." }, { status: 400 });
  const email = parsed.data.email.toLowerCase();
  const reset = await prisma.passwordResetCode.findFirst({ where: { email, consumedAt: null, expiresAt: { gt: new Date() } }, orderBy: { createdAt: "desc" } });
  if (!reset || !(await compare(parsed.data.code, reset.codeHash))) return NextResponse.json({ error: "The reset code is invalid or has expired." }, { status: 400 });
  await prisma.$transaction([prisma.user.update({ where: { id: reset.userId }, data: { passwordHash: await hash(parsed.data.password, 12) } }), prisma.passwordResetCode.update({ where: { id: reset.id }, data: { consumedAt: new Date() } })]);
  return NextResponse.json({ ok: true, message: "Password updated. You can sign in now." });
}
