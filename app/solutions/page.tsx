import type { Metadata } from "next";
import { BriefcaseBusiness, Globe2, Layers3, Newspaper, PenTool, Users } from "lucide-react";
import PublicPage from "@/components/public/PublicPage";
import PageHero from "@/components/public/PageHero";
import FeatureCard from "@/components/public/FeatureCard";

export const metadata: Metadata = { title: "Solutions | AI Article Publisher", description: "AI publishing workflows for agencies, blog networks, news publishers, freelancers, WordPress owners, and content teams." };
const solutions = [
  [BriefcaseBusiness, "SEO Agencies", "Manage briefs, required links, SEO fields, and publishing across multiple client WordPress sites."],
  [Layers3, "Blog Networks", "Standardize high-volume output while keeping each site’s taxonomy and review workflow intact."],
  [Newspaper, "News Publishers", "Turn timely source material into original drafts with fresh visuals and controlled scheduling."],
  [PenTool, "Freelance Writers", "Move client-ready work from brief or Google Doc into a clean WordPress draft faster."],
  [Globe2, "WordPress Site Owners", "Generate articles, media, metadata, and posts without maintaining a complicated tool stack."],
  [Users, "Content Teams", "Give writers and editors one shared process for generation, preview, review, and delivery."],
] as const;
export default function SolutionsPage() { return <PublicPage><PageHero eyebrow="Solutions" title="Designed around the way publishing teams actually work" description="Choose a workflow that fits your operating model, from one WordPress site to a growing client portfolio." /><section className="py-20"><div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8"><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{solutions.map(([icon, title, description]) => <FeatureCard key={title} icon={icon} title={title} description={description} />)}</div><div className="mt-12 grid gap-5 rounded-[28px] bg-slate-950 p-7 text-white sm:p-10 lg:grid-cols-3"><div><p className="text-2xl font-semibold">One operating model</p><p className="mt-2 text-xs leading-6 text-slate-400">Connect the content lifecycle without sacrificing editorial control.</p></div>{[["01", "Create consistently"], ["02", "Review confidently"], ["03", "Publish predictably"]].map(([number, label]) => <div key={number} className="rounded-2xl border border-slate-800 bg-slate-900 p-5"><p className="text-xs font-bold text-blue-400">{number}</p><p className="mt-4 text-sm font-semibold">{label}</p></div>)}</div></div></section></PublicPage>; }
