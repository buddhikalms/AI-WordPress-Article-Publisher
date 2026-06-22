import type { ReactNode } from "react";
import { FileText, Globe2, SearchCheck, Sparkles } from "lucide-react";
import BrandLogo from "@/components/public/BrandLogo";

const benefits = [
  [SearchCheck, "Generate SEO-ready articles"],
  [Globe2, "Publish directly to WordPress"],
  [FileText, "Schedule content faster"],
] as const;

export default function AuthShell({ children }: { children: ReactNode }) {
  return (
    <main className="marketing-page grid min-h-screen bg-white lg:grid-cols-[0.9fr_1.1fr]">
      <aside className="relative hidden overflow-hidden bg-slate-950 p-10 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(37,99,235,0.35),transparent_38%)]" />
        <div className="relative"><BrandLogo inverse /></div>
        <div className="relative max-w-lg">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-blue-400">Professional content operations</p>
          <h1 className="mt-4 text-4xl font-semibold tracking-[-0.05em] text-white">Create better WordPress content with fewer handoffs.</h1>
          <p className="mt-5 text-sm leading-7 text-slate-400">AI Article Publisher brings generation, imagery, SEO, review, and publishing into one controlled workspace.</p>
          <div className="mt-7 space-y-3">
            {benefits.map(([Icon, label]) => <div key={label} className="flex items-center gap-3 text-xs text-slate-200"><Icon className="h-4 w-4 text-emerald-400" />{label}</div>)}
          </div>
          <div className="mt-9 rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
            <div className="flex items-center justify-between"><p className="text-[10px] font-semibold text-white">Publishing workspace</p><span className="rounded-full bg-emerald-400/10 px-2 py-1 text-[8px] font-bold text-emerald-300">READY</span></div>
            <div className="mt-4 grid grid-cols-3 gap-2">{["Article", "SEO", "WordPress"].map((item) => <div key={item} className="rounded-xl bg-white/5 p-3"><Sparkles className="h-3.5 w-3.5 text-blue-400" /><p className="mt-3 text-[9px] text-slate-300">{item}</p></div>)}</div>
          </div>
        </div>
        <p className="relative text-[10px] text-slate-500">Secure authentication. Editorial control. Transparent usage.</p>
      </aside>
      <section className="flex min-h-screen items-center justify-center px-4 py-10 sm:px-6"><div className="w-full max-w-md"><div className="mb-8 lg:hidden"><BrandLogo /></div>{children}</div></section>
    </main>
  );
}
