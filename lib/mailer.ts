import nodemailer from "nodemailer";
import { HttpError } from "@/lib/errors";

const getSmtpConfig = () => {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const secure = process.env.SMTP_SECURE === "true";
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM || user;

  if (!host || !user || !pass || !from) {
    throw new HttpError(
      500,
      "SMTP config is missing. Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, and SMTP_FROM.",
    );
  }

  return {
    host,
    port,
    secure,
    auth: { user, pass },
    from,
  };
};

let transporter: nodemailer.Transporter | null = null;

const getTransporter = () => {
  if (!transporter) {
    const smtp = getSmtpConfig();
    transporter = nodemailer.createTransport({
      host: smtp.host,
      port: smtp.port,
      secure: smtp.secure,
      auth: smtp.auth,
    });
  }

  return transporter;
};

export const sendVerificationCodeEmail = async (params: {
  email: string;
  name?: string | null;
  code: string;
}) => {
  const smtp = getSmtpConfig();
  const transport = getTransporter();
  const greeting = params.name?.trim() ? `Hi ${params.name.trim()},` : "Hi,";

  const text = [
    greeting,
    "",
    `Your email verification code is: ${params.code}`,
    "This code expires in 15 minutes.",
    "",
    "If you did not request this, you can ignore this email.",
  ].join("\n");

  const html = [
    `<p>${greeting}</p>`,
    "<p>Your email verification code is:</p>",
    `<p style=\"font-size:24px;font-weight:700;letter-spacing:4px;\">${params.code}</p>`,
    "<p>This code expires in 15 minutes.</p>",
    "<p>If you did not request this, you can ignore this email.</p>",
  ].join("");

  await transport.sendMail({
    from: smtp.from,
    to: params.email,
    subject: "Verify your account",
    text,
    html,
  });
};