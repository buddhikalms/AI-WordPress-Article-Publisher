import type { Metadata } from "next";
import { BookOpenCheck, Braces, FileClock, KeyRound, LockKeyhole, ShieldCheck } from "lucide-react";
import PublicPage from "@/components/public/PublicPage";
import PageHero from "@/components/public/PageHero";
import FeatureCard from "@/components/public/FeatureCard";

export const metadata: Metadata = { title: "Security | AI Article Publisher", description: "Learn how AI Article Publisher protects authentication, WordPress credentials, API requests, usage, and publishing control." };
const controls = [
  [LockKeyhole, "Encrypted WordPress credentials", "Application Passwords are encrypted at rest with a dedicated application encryption key."],
  [KeyRound, "Secure authentication", "Verified credentials accounts, Google OAuth, JWT sessions, and role-aware administrator routes."],
  [BookOpenCheck, "Editorial review", "Preview and draft workflows preserve a human approval point before content goes live."],
  [FileClock, "Token usage logs", "Metered generation and publishing actions create balance and usage records for accountability."],
  [Braces, "API validation", "Zod schemas constrain URLs, statuses, dates, counts, and user-submitted request payloads."],
  [ShieldCheck, "WordPress publishing safety", "Application Password auth and WordPress capabilities limit what connected accounts can do."],
] as const;
export default function SecurityPage() { return <PublicPage><PageHero eyebrow="Security and trust" title="Controls for credentials, content, and publishing decisions" description="Security is built into the workflow, from authentication and validation to token accounting and WordPress delivery." /><section className="py-20"><div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8"><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{controls.map(([icon, title, description]) => <FeatureCard key={title} icon={icon} title={title} description={description} />)}</div><div className="mt-12 rounded-[28px] border border-emerald-200 bg-emerald-50 p-7 sm:p-10"><p className="text-[11px] font-bold uppercase tracking-[0.2em] text-emerald-700">Shared responsibility</p><h2 className="mt-3 text-2xl font-semibold text-slate-950">Your team remains in control</h2><p className="mt-4 max-w-3xl text-sm leading-7 text-slate-600">Use least-privilege WordPress accounts, HTTPS, protected environment variables, credential rotation, staging tests, and editorial review. AI Article Publisher supports these practices; it does not replace them.</p></div></div></section></PublicPage>; }
