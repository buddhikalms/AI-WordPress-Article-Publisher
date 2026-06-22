import { NextResponse } from "next/server";
import { contactInquirySchema } from "@/lib/contact-schema";
import { sendContactInquiryEmail } from "@/lib/mailer";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = contactInquirySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Please correct the highlighted fields.", details: parsed.error.flatten().fieldErrors }, { status: 400 });
    }

    const inquiry = await prisma.contactInquiry.create({ data: parsed.data });
    try {
      await sendContactInquiryEmail(parsed.data);
    } catch (error) {
      console.error("Contact notification email failed", { inquiryId: inquiry.id, error: error instanceof Error ? error.message : "Unknown mail error" });
    }

    return NextResponse.json({ ok: true, inquiryId: inquiry.id, message: "Thanks. Your inquiry has been received." }, { status: 201 });
  } catch (error) {
    console.error("Contact inquiry could not be saved", { error: error instanceof Error ? error.message : "Unknown contact error" });
    return NextResponse.json({ error: "We could not send your inquiry. Please try again shortly." }, { status: 500 });
  }
}
