"use client";

import { useState, type FormEvent } from "react";
import { CheckCircle2, Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { contactInquirySchema, inquiryTypes, type ContactInquiryInput } from "@/lib/contact-schema";

const initial: ContactInquiryInput = { name: "", email: "", company: "", websiteUrl: "", inquiryType: "General question", message: "" };

export default function ContactForm() {
  const [values, setValues] = useState<ContactInquiryInput>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  const set = (key: keyof ContactInquiryInput, value: string) => { setValues((current) => ({ ...current, [key]: value })); setErrors((current) => ({ ...current, [key]: "" })); };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const parsed = contactInquirySchema.safeParse(values);
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) next[String(issue.path[0])] = issue.message;
      setErrors(next); return;
    }
    setStatus("loading"); setMessage("");
    try {
      const response = await fetch("/api/contact", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(parsed.data) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Unable to submit inquiry.");
      setValues(initial); setStatus("success"); setMessage(payload.message);
    } catch (error) { setStatus("error"); setMessage(error instanceof Error ? error.message : "Unable to submit inquiry."); }
  };

  if (status === "success") return <div className="flex min-h-[480px] flex-col items-center justify-center rounded-2xl border border-emerald-200 bg-emerald-50 p-8 text-center"><span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-600 text-white"><CheckCircle2 className="h-6 w-6" /></span><h2 className="mt-5 text-xl font-semibold text-slate-950">Message received</h2><p className="mt-3 max-w-sm text-sm leading-7 text-slate-600">{message} Our team will reply as soon as possible.</p><Button className="mt-6" variant="outline" onClick={() => setStatus("idle")}>Send another inquiry</Button></div>;

  return <form onSubmit={submit} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7" noValidate><div className="grid gap-4 sm:grid-cols-2"><Field label="Name" error={errors.name}><Input value={values.name} onChange={(e) => set("name", e.target.value)} placeholder="Your name" /></Field><Field label="Email" error={errors.email}><Input type="email" value={values.email} onChange={(e) => set("email", e.target.value)} placeholder="you@company.com" /></Field><Field label="Company" error={errors.company}><Input value={values.company || ""} onChange={(e) => set("company", e.target.value)} placeholder="Optional" /></Field><Field label="Website URL" error={errors.websiteUrl}><Input type="url" value={values.websiteUrl || ""} onChange={(e) => set("websiteUrl", e.target.value)} placeholder="https://example.com" /></Field></div><div className="mt-4"><Field label="Inquiry type" error={errors.inquiryType}><select className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-950 focus:border-blue-500 focus:ring-4 focus:ring-blue-100" value={values.inquiryType} onChange={(e) => set("inquiryType", e.target.value)}>{inquiryTypes.map((type) => <option key={type}>{type}</option>)}</select></Field></div><div className="mt-4"><Field label="Message" error={errors.message}><Textarea value={values.message} onChange={(e) => set("message", e.target.value)} placeholder="Tell us about your publishing workflow, sites, and goals." /></Field></div>{status === "error" ? <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{message}</p> : null}<Button type="submit" className="mt-5 w-full sm:w-auto" disabled={status === "loading"}>{status === "loading" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}{status === "loading" ? "Sending..." : "Send inquiry"}</Button></form>;
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) { return <div><Label>{label}</Label>{children}{error ? <p className="mt-1 text-[11px] text-red-600">{error}</p> : null}</div>; }
