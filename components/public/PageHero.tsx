import type { ReactNode } from "react";

export default function PageHero({ eyebrow, title, description, children }: { eyebrow: string; title: string; description: string; children?: ReactNode }) {
  return (
    <section className="relative overflow-hidden border-b border-slate-200 bg-slate-50/70 pb-16 pt-32 sm:pb-20 sm:pt-36">
      <div className="absolute inset-x-0 top-0 h-[440px] bg-[radial-gradient(circle_at_50%_0%,rgba(59,130,246,0.14),transparent_50%)]" />
      <div className="relative mx-auto max-w-4xl px-4 text-center sm:px-6"><p className="text-[11px] font-bold uppercase tracking-[0.2em] text-blue-700">{eyebrow}</p><h1 className="mx-auto mt-4 max-w-3xl text-4xl font-semibold leading-tight tracking-[-0.05em] text-slate-950 sm:text-5xl">{title}</h1><p className="mx-auto mt-5 max-w-2xl text-sm leading-7 text-slate-600 sm:text-base">{description}</p>{children ? <div className="mt-8 flex flex-wrap justify-center gap-3">{children}</div> : null}</div>
    </section>
  );
}
