"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import {
  ArrowRight,
  BadgeCheck,
  BarChart3,
  BookOpen,
  Bot,
  BriefcaseBusiness,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  CloudUpload,
  Code2,
  FileText,
  Globe2,
  ImageIcon,
  Layers3,
  LockKeyhole,
  Newspaper,
  PenTool,
  Play,
  SearchCheck,
  ShieldCheck,
  Sparkles,
  Users,
  WandSparkles,
  Zap,
} from "lucide-react";
import type { ReactNode } from "react";
import PublicHeader from "@/components/public/PublicHeader";
import PublicFooter from "@/components/public/PublicFooter";

const features = [
  { icon: WandSparkles, title: "AI Article Generator", copy: "Turn structured briefs, keywords, and links into polished WordPress-ready HTML." },
  { icon: CloudUpload, title: "WordPress Auto Publishing", copy: "Create drafts, publish immediately, or schedule posts across connected sites." },
  { icon: FileText, title: "Google Doc Import", copy: "Preserve article structure, metadata, and embedded images from a public Google Doc." },
  { icon: Newspaper, title: "News Autopilot", copy: "Transform current NewsData stories into fresh, editable, source-aware drafts." },
  { icon: ImageIcon, title: "AI Image Generation", copy: "Create featured visuals and add up to 10 relevant in-post images." },
  { icon: SearchCheck, title: "SEO Metadata Generator", copy: "Prepare titles, descriptions, keywords, canonical links, AIOSEO, and Yoast data." },
];

const workflowSteps = [
  ["01", "Add your brief", "Set the topic, keyword, tone, links, and target length."],
  ["02", "Generate article", "Produce structured, WordPress-ready content in one request."],
  ["03", "Create images & SEO", "Generate visuals and complete search and social metadata."],
  ["04", "Review preview", "Edit content, check links, and approve the final presentation."],
  ["05", "Publish your way", "Save a draft, publish now, or schedule for the right moment."],
] as const;

const ecosystem = [
  ["OpenAI", Sparkles],
  ["Google Docs", FileText],
  ["NewsData", Newspaper],
  ["WordPress", Globe2],
  ["AIOSEO", SearchCheck],
  ["Yoast", BadgeCheck],
  ["Token Billing", CircleDollarSign],
  ["Media Library", ImageIcon],
] as const;

const useCases = [
  ["SEO Agencies", BriefcaseBusiness, "Manage production for multiple client sites from a single workspace."],
  ["Blog Networks", Layers3, "Keep high-volume content structured, tagged, and ready for review."],
  ["News Publishers", Newspaper, "Turn current topics into timely drafts with fresh visuals."],
  ["Freelance Writers", PenTool, "Move from client brief to WordPress draft without repetitive admin work."],
  ["WordPress Owners", Globe2, "Generate, optimize, and publish without stitching together separate tools."],
  ["Content Teams", Users, "Create a consistent editorial workflow around briefs, Docs, and approvals."],
] as const;

const plans = [
  {
    name: "Starter",
    price: "$19",
    description: "For individual site owners building a consistent publishing rhythm.",
    features: ["1 user", "1 WordPress site", "Limited monthly articles", "Basic image generation"],
    featured: false,
  },
  {
    name: "Pro",
    price: "$49",
    description: "For content teams managing more channels and more ambitious workflows.",
    features: ["Multiple WordPress sites", "Higher article allowance", "Google Doc import", "News Autopilot"],
    featured: true,
  },
  {
    name: "Agency",
    price: "$129",
    description: "For agencies delivering repeatable publishing operations at scale.",
    features: ["Many WordPress sites", "Team workflow", "Priority support", "White-label ready"],
    featured: false,
  },
] as const;

const faqs = [
  ["Does it publish directly to WordPress?", "Yes. Connect WordPress with an Application Password, then create categories, tags, media, and posts through the secure REST API."],
  ["Can I save posts as drafts?", "Yes. Every core workflow supports editorial control, and draft mode is the recommended default for review."],
  ["Does it support SEO plugins?", "Yes. AI Article Publisher supports AIOSEO and Yoast metadata, including titles, descriptions, focus keywords, canonical URLs, and social fields."],
  ["Can I import Google Docs?", "Yes. Public Google Docs can be imported with document formatting, front matter, and embedded images."],
  ["Can I generate images?", "Yes. Generate a featured image plus up to 10 contextual images for placement inside the article."],
  ["Can I schedule posts?", "Yes. Choose draft, publish now, or a future publishing time from the workflow."],
] as const;

function SectionHeading({ eyebrow, title, copy, centered = false }: { eyebrow: string; title: string; copy?: string; centered?: boolean }) {
  return (
    <div className={centered ? "mx-auto max-w-2xl text-center" : "max-w-2xl"}>
      <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-blue-700">{eyebrow}</p>
      <h2 className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-slate-950 sm:text-3xl">{title}</h2>
      {copy ? <p className="mt-4 text-sm leading-7 text-slate-600">{copy}</p> : null}
    </div>
  );
}

function Reveal({ children, delay = 0, className = "" }: { children: ReactNode; delay?: number; className?: string }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 20 }}
      whileInView={reduce ? undefined : { opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.55, delay, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

function DashboardMockup() {
  const statuses = [
    ["Article generated", CheckCircle2, "text-emerald-600", "top-[12%] -left-5 lg:-left-14"],
    ["Image ready", ImageIcon, "text-blue-600", "top-[34%] -right-4 lg:-right-14"],
    ["SEO metadata added", SearchCheck, "text-indigo-600", "bottom-[28%] -left-3 lg:-left-16"],
    ["WordPress draft created", Globe2, "text-emerald-600", "bottom-[8%] -right-3 lg:-right-12"],
  ] as const;

  return (
    <div className="relative mx-auto w-full max-w-[660px] px-3 py-8 sm:px-8">
      <div className="absolute inset-x-[8%] top-[15%] h-[72%] rounded-full bg-blue-500/20 blur-3xl" />
      <motion.div
        initial={{ opacity: 0, y: 24, rotateX: 4 }}
        animate={{ opacity: 1, y: 0, rotateX: 0 }}
        transition={{ duration: 0.8, delay: 0.15 }}
        className="relative overflow-hidden rounded-[26px] border border-slate-200 bg-white shadow-[0_30px_80px_rgba(15,23,42,0.16)]"
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <div className="flex gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-red-400" /><span className="h-2.5 w-2.5 rounded-full bg-amber-400" /><span className="h-2.5 w-2.5 rounded-full bg-emerald-400" /></div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-[9px] font-semibold text-slate-500">app.aiarticlepublisher.com</span>
          <span className="h-6 w-6 rounded-lg bg-slate-100" />
        </div>
        <div className="grid min-h-[380px] grid-cols-[82px_1fr] sm:grid-cols-[130px_1fr]">
          <aside className="border-r border-slate-200 bg-slate-950 p-3 sm:p-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white"><PenTool className="h-3.5 w-3.5" /></div>
            <div className="mt-7 space-y-2">
              {["Studio", "Documents", "Websites", "Billing"].map((item, index) => (
                <div key={item} className={`rounded-lg px-2 py-2 text-[9px] font-medium ${index === 0 ? "bg-white/10 text-white" : "text-slate-500"}`}>{item}</div>
              ))}
            </div>
          </aside>
          <div className="bg-slate-50/70 p-3 sm:p-5">
            <div className="flex items-center justify-between">
              <div><p className="text-[9px] font-bold uppercase tracking-widest text-blue-600">Publishing workspace</p><p className="mt-1 text-sm font-semibold text-slate-950">New AI article</p></div>
              <span className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[9px] font-semibold text-slate-600">2,450 tokens</span>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2">
              {[["SEO score", "92/100", "text-emerald-600"], ["WordPress", "Connected", "text-blue-600"], ["Post status", "Scheduled", "text-indigo-600"]].map(([label, value, color]) => (
                <div key={label} className="rounded-xl border border-slate-200 bg-white p-2.5"><p className="text-[8px] text-slate-400">{label}</p><p className={`mt-1 text-[10px] font-bold ${color}`}>{value}</p></div>
              ))}
            </div>
            <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-3 sm:p-4">
              <div className="flex items-center justify-between"><span className="text-[9px] font-semibold text-slate-950">How AI transforms content publishing</span><span className="rounded-full bg-emerald-50 px-2 py-1 text-[8px] font-semibold text-emerald-700">Article ready</span></div>
              <div className="mt-4 grid gap-4 sm:grid-cols-[1fr_110px]">
                <div className="space-y-2"><div className="h-2 w-full rounded bg-slate-200" /><div className="h-2 w-[92%] rounded bg-slate-200" /><div className="h-2 w-[84%] rounded bg-slate-200" /><div className="pt-2"><div className="h-2 w-[55%] rounded bg-slate-300" /></div><div className="h-2 w-full rounded bg-slate-200" /><div className="h-2 w-[76%] rounded bg-slate-200" /></div>
                <div className="flex min-h-24 items-center justify-center rounded-xl bg-gradient-to-br from-blue-100 via-indigo-100 to-slate-100"><Sparkles className="h-8 w-8 text-blue-600" /></div>
              </div>
              <div className="mt-4 flex gap-2"><span className="rounded-lg bg-blue-600 px-3 py-2 text-[8px] font-semibold text-white">Schedule post</span><span className="rounded-lg border border-slate-200 px-3 py-2 text-[8px] font-semibold text-slate-600">Preview</span></div>
            </div>
          </div>
        </div>
      </motion.div>
      {statuses.map(([label, Icon, color, position], index) => (
        <motion.div key={label} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1, y: [0, -4, 0] }} transition={{ opacity: { delay: 0.65 + index * 0.1 }, scale: { delay: 0.65 + index * 0.1 }, y: { duration: 3.5 + index * 0.3, repeat: Infinity, ease: "easeInOut" } }} className={`absolute z-10 hidden items-center gap-2 rounded-xl border border-slate-200 bg-white/95 px-3 py-2 text-[10px] font-semibold text-slate-700 shadow-lg backdrop-blur sm:flex ${position}`}>
          <Icon className={`h-3.5 w-3.5 ${color}`} />{label}
        </motion.div>
      ))}
    </div>
  );
}

export default function LandingPage() {
  return (
    <div className="marketing-page min-h-screen overflow-hidden bg-white text-slate-950">
      <PublicHeader />

      <main>
        <section className="relative pt-28 sm:pt-32">
          <div className="absolute inset-x-0 top-0 -z-10 h-[720px] bg-[radial-gradient(circle_at_50%_0%,rgba(59,130,246,0.14),transparent_45%)]" />
          <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 pb-16 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:px-8 lg:pb-24">
            <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.65 }}>
              <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-blue-700"><Sparkles className="h-3 w-3" />One workflow. Every publishing step.</div>
              <h1 className="mt-6 max-w-xl text-4xl font-semibold leading-[1.08] tracking-[-0.055em] text-slate-950 sm:text-5xl lg:text-[56px]">Publish SEO-ready WordPress articles in minutes</h1>
              <p className="mt-6 max-w-xl text-base leading-8 text-slate-600">Generate articles, images, SEO metadata, Google Doc imports, and news-based drafts from one professional AI publishing workflow.</p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link href="/register" className="group inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-xs font-semibold text-white shadow-lg shadow-blue-600/20 transition hover:-translate-y-0.5 hover:bg-blue-700">Start Free <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" /></Link>
                <a href="#workflow" className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-3 text-xs font-semibold text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300"><Play className="h-3.5 w-3.5 fill-slate-700" />View Demo</a>
              </div>
              <div className="mt-7 flex flex-wrap gap-x-5 gap-y-2 text-[11px] text-slate-500">{["No credit card required", "WordPress REST ready", "Draft-first control"].map((item) => <span key={item} className="flex items-center gap-1.5"><Check className="h-3 w-3 text-emerald-600" />{item}</span>)}</div>
            </motion.div>
            <DashboardMockup />
          </div>
        </section>

        <section className="border-y border-slate-200 bg-slate-50/70">
          <div className="mx-auto grid max-w-7xl grid-cols-2 px-4 py-7 sm:px-6 lg:grid-cols-4 lg:px-8">
            {[["5 min", "average article workflow"], ["10", "in-post images supported"], ["Multi-site", "WordPress publishing"], ["Built in", "SEO metadata included"]].map(([value, label], index) => <div key={label} className={`px-4 py-3 ${index % 2 ? "border-l border-slate-200" : ""} ${index > 1 ? "border-t border-slate-200 lg:border-t-0 lg:border-l" : ""}`}><p className="text-lg font-semibold tracking-tight text-slate-950">{value}</p><p className="mt-1 text-[11px] text-slate-500">{label}</p></div>)}
          </div>
        </section>

        <section id="features" className="scroll-mt-20 py-20 sm:py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <Reveal><SectionHeading centered eyebrow="Complete publishing stack" title="Everything between the idea and the live post" copy="Replace disconnected writing, image, SEO, and WordPress tasks with one controlled production system." /></Reveal>
            <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {features.map(({ icon: Icon, title, copy }, index) => <Reveal key={title} delay={(index % 3) * 0.07}><article className="group h-full rounded-2xl border border-slate-200 bg-white p-5 transition duration-300 hover:-translate-y-1 hover:border-blue-200 hover:shadow-[0_18px_50px_rgba(15,23,42,0.08)]"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-700 transition group-hover:bg-blue-600 group-hover:text-white"><Icon className="h-4.5 w-4.5" /></span><h3 className="mt-5 text-sm font-semibold text-slate-950">{title}</h3><p className="mt-2 text-xs leading-6 text-slate-600">{copy}</p><span className="mt-5 inline-flex items-center gap-1 text-[11px] font-semibold text-blue-700">Explore feature <ChevronRight className="h-3 w-3" /></span></article></Reveal>)}
            </div>
          </div>
        </section>

        <section id="workflow" className="scroll-mt-20 bg-slate-950 py-20 text-white sm:py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <Reveal><div className="max-w-2xl"><p className="text-[11px] font-bold uppercase tracking-[0.2em] text-blue-400">A calmer content operation</p><h2 className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-white sm:text-3xl">From idea to WordPress draft in one workflow</h2><p className="mt-4 text-sm leading-7 text-slate-400">Keep the team moving without losing the review points that protect quality.</p></div></Reveal>
            <div className="relative mt-12 grid gap-3 lg:grid-cols-5">
              <div className="absolute left-[10%] right-[10%] top-7 hidden border-t border-dashed border-slate-700 lg:block" />
              {workflowSteps.map(([number, title, copy], index) => <Reveal key={number} delay={index * 0.06} className="relative"><article className="h-full rounded-2xl border border-slate-800 bg-slate-900/80 p-5"><span className="relative z-10 flex h-11 w-11 items-center justify-center rounded-xl border border-blue-500/30 bg-blue-500/10 text-xs font-bold text-blue-300">{number}</span><h3 className="mt-5 text-sm font-semibold text-white">{title}</h3><p className="mt-2 text-xs leading-6 text-slate-400">{copy}</p></article></Reveal>)}
            </div>
          </div>
        </section>

        <section id="integrations" className="scroll-mt-20 py-20 sm:py-24">
          <div className="mx-auto grid max-w-7xl items-center gap-14 px-4 sm:px-6 lg:grid-cols-[0.75fr_1.25fr] lg:px-8">
            <Reveal><SectionHeading eyebrow="Product ecosystem" title="Your publishing stack, connected" copy="AI Article Publisher coordinates the services your team already depends on, with WordPress at the center of delivery." /><div className="mt-7 space-y-3">{["Generate text and images", "Import editorial source material", "Publish taxonomy, media, and SEO data"].map((item) => <div key={item} className="flex items-center gap-3 text-xs text-slate-700"><CheckCircle2 className="h-4 w-4 text-emerald-600" />{item}</div>)}</div></Reveal>
            <Reveal className="relative min-h-[430px] rounded-[30px] border border-slate-200 bg-slate-50 p-5 sm:p-8">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(37,99,235,0.12),transparent_48%)]" />
              <div className="relative grid h-full min-h-[370px] grid-cols-2 content-between gap-4 sm:grid-cols-4">
                {ecosystem.map(([label, Icon], index) => <motion.div key={label} whileHover={{ y: -4 }} className={`relative z-10 flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-3 text-[10px] font-semibold text-slate-700 shadow-sm ${index >= 4 ? "self-end" : "self-start"}`}><Icon className="h-3.5 w-3.5 text-blue-600" />{label}</motion.div>)}
                <div className="absolute left-1/2 top-1/2 z-20 flex h-32 w-32 -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-full border-[6px] border-white bg-gradient-to-br from-blue-600 to-indigo-700 text-center text-white shadow-2xl shadow-blue-600/25"><Bot className="h-6 w-6" /><span className="mt-2 text-xs font-bold">AI Publisher</span><span className="mt-1 text-[8px] text-blue-100">Content operations</span></div>
                <div className="absolute left-1/2 top-1/2 h-px w-[70%] -translate-x-1/2 bg-blue-200" /><div className="absolute left-1/2 top-1/2 h-[70%] w-px -translate-y-1/2 bg-blue-200" />
              </div>
            </Reveal>
          </div>
        </section>

        <section className="bg-blue-50/60 py-20 sm:py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <Reveal><SectionHeading centered eyebrow="Immediate operational value" title="Four things your team will feel on day one" /></Reveal>
            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{[[Clock3, "Save hours of manual writing"], [SearchCheck, "Keep SEO metadata consistent"], [Zap, "Publish across sites faster"], [FileText, "Turn Docs and news into drafts"]].map(([Icon, title], index) => <Reveal key={title as string} delay={index * 0.06}><article className="h-full rounded-2xl border border-blue-100 bg-white p-5"><Icon className="h-5 w-5 text-blue-700" /><h3 className="mt-7 text-sm font-semibold leading-6 text-slate-950">{title as string}</h3><p className="mt-2 text-xs leading-6 text-slate-600">Less admin work, clearer handoffs, and more time for editorial judgment.</p></article></Reveal>)}</div>
          </div>
        </section>

        <section id="use-cases" className="scroll-mt-20 py-20 sm:py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8"><Reveal><SectionHeading eyebrow="Built for publishing teams" title="One platform, many content operations" copy="Flexible enough for a solo site owner, structured enough for an agency portfolio." /></Reveal><div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{useCases.map(([title, Icon, copy], index) => <Reveal key={title} delay={(index % 3) * 0.05}><article className="flex h-full gap-4 rounded-2xl border border-slate-200 p-5 transition hover:border-slate-300 hover:bg-slate-50"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-950 text-white"><Icon className="h-4 w-4" /></span><div><h3 className="text-sm font-semibold text-slate-950">{title}</h3><p className="mt-2 text-xs leading-6 text-slate-600">{copy}</p></div></article></Reveal>)}</div></div>
        </section>

        <section id="security" className="scroll-mt-20 py-4 sm:py-8">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8"><Reveal><div className="grid overflow-hidden rounded-[30px] bg-slate-950 lg:grid-cols-[0.8fr_1.2fr]"><div className="p-7 sm:p-10"><span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-400/10 text-emerald-400"><ShieldCheck className="h-6 w-6" /></span><p className="mt-8 text-[11px] font-bold uppercase tracking-[0.2em] text-emerald-400">Security by workflow</p><h2 className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-white">Control access without slowing production</h2><p className="mt-4 text-sm leading-7 text-slate-400">Purpose-built controls protect credentials, spending, and the final publishing decision.</p></div><div className="grid gap-px bg-slate-800 sm:grid-cols-2">{[[LockKeyhole, "Encrypted credentials", "WordPress Application Passwords are encrypted before database storage."], [BookOpen, "Editorial review", "Preview and draft modes keep a person in control before content goes live."], [BarChart3, "Token tracking", "Every metered action is checked, charged, and recorded for visibility."], [Code2, "Secure REST publishing", "Authenticated WordPress APIs, admin roles, and usage logs protect operations."]].map(([Icon, title, copy]) => <div key={title as string} className="bg-slate-900 p-6"><Icon className="h-5 w-5 text-blue-400" /><h3 className="mt-5 text-sm font-semibold text-white">{title as string}</h3><p className="mt-2 text-xs leading-6 text-slate-400">{copy as string}</p></div>)}</div></div></Reveal></div>
        </section>

        <section id="pricing" className="scroll-mt-20 py-20 sm:py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8"><Reveal><SectionHeading centered eyebrow="Simple plans" title="Pricing that grows with your publishing operation" copy="Placeholder launch pricing shown below. Every plan uses transparent token-based generation and publishing." /></Reveal><div className="mt-12 grid gap-5 lg:grid-cols-3">{plans.map((plan, index) => <Reveal key={plan.name} delay={index * 0.07}><article className={`relative h-full rounded-[26px] border p-6 ${plan.featured ? "border-blue-600 bg-slate-950 text-white shadow-2xl shadow-blue-900/15" : "border-slate-200 bg-white"}`}>{plan.featured ? <span className="absolute right-5 top-5 rounded-full bg-blue-600 px-3 py-1 text-[9px] font-bold uppercase tracking-widest text-white">Most popular</span> : null}<p className={`text-xs font-semibold ${plan.featured ? "text-blue-300" : "text-blue-700"}`}>{plan.name}</p><div className="mt-5 flex items-end gap-1"><span className={`text-4xl font-semibold tracking-tight ${plan.featured ? "text-white" : "text-slate-950"}`}>{plan.price}</span><span className={`pb-1 text-xs ${plan.featured ? "text-slate-400" : "text-slate-500"}`}>/month</span></div><p className={`mt-4 min-h-12 text-xs leading-6 ${plan.featured ? "text-slate-400" : "text-slate-600"}`}>{plan.description}</p><div className={`my-6 h-px ${plan.featured ? "bg-slate-800" : "bg-slate-200"}`} /><ul className="space-y-3">{plan.features.map((feature) => <li key={feature} className={`flex items-center gap-2 text-xs ${plan.featured ? "text-slate-300" : "text-slate-700"}`}><CheckCircle2 className={`h-3.5 w-3.5 ${plan.featured ? "text-blue-400" : "text-emerald-600"}`} />{feature}</li>)}</ul><Link href="/login" className={`mt-8 block rounded-xl px-4 py-3 text-center text-xs font-semibold transition ${plan.featured ? "bg-blue-600 text-white hover:bg-blue-500" : "border border-slate-200 text-slate-800 hover:border-blue-300 hover:bg-blue-50"}`}>Start Free</Link></article></Reveal>)}</div></div>
        </section>

        <section className="border-y border-slate-200 bg-slate-50 py-20 sm:py-24">
          <div className="mx-auto grid max-w-6xl gap-10 px-4 sm:px-6 lg:grid-cols-[0.65fr_1.35fr] lg:px-8"><Reveal><SectionHeading eyebrow="Questions, answered" title="Frequently asked questions" copy="The practical details teams ask before connecting their first site." /></Reveal><Reveal><div className="divide-y divide-slate-200 rounded-2xl border border-slate-200 bg-white px-5">{faqs.map(([question, answer], index) => <details key={question} className="group py-5" open={index === 0}><summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-semibold text-slate-950">{question}<span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600 transition group-open:rotate-90"><ChevronRight className="h-3.5 w-3.5" /></span></summary><p className="mt-3 max-w-2xl pr-10 text-xs leading-6 text-slate-600">{answer}</p></details>)}</div></Reveal></div>
        </section>

        <section className="py-20 sm:py-24"><div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8"><Reveal><div className="relative overflow-hidden rounded-[32px] bg-gradient-to-br from-blue-600 to-indigo-800 px-6 py-14 text-center shadow-2xl shadow-blue-900/20 sm:px-12"><div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(255,255,255,0.22),transparent_35%)]" /><div className="relative"><p className="text-[11px] font-bold uppercase tracking-[0.2em] text-blue-100">Your next draft is minutes away</p><h2 className="mx-auto mt-4 max-w-2xl text-3xl font-semibold tracking-[-0.045em] text-white">Start publishing smarter content today</h2><p className="mx-auto mt-4 max-w-xl text-sm leading-7 text-blue-100">Create, optimize, and publish SEO-ready WordPress articles with AI.</p><div className="mt-8 flex flex-wrap justify-center gap-3"><Link href="/login" className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-xs font-semibold text-blue-700 transition hover:-translate-y-0.5">Start Free <ArrowRight className="h-3.5 w-3.5" /></Link><a href="#workflow" className="inline-flex items-center gap-2 rounded-xl border border-white/25 bg-white/10 px-5 py-3 text-xs font-semibold text-white transition hover:bg-white/15"><Play className="h-3.5 w-3.5" />View Demo</a></div></div></div></Reveal></div></section>
      </main>

      <PublicFooter />
    </div>
  );
}
