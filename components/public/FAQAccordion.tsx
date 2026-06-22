import { ChevronRight } from "lucide-react";

export default function FAQAccordion({ items }: { items: Array<[string, string]> | ReadonlyArray<readonly [string, string]> }) {
  return <div className="divide-y divide-slate-200 rounded-2xl border border-slate-200 bg-white px-5">{items.map(([question, answer], index) => <details key={question} className="group py-5" open={index === 0}><summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-semibold text-slate-950">{question}<span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600 transition group-open:rotate-90"><ChevronRight className="h-3.5 w-3.5" /></span></summary><p className="mt-3 max-w-2xl pr-10 text-xs leading-6 text-slate-600">{answer}</p></details>)}</div>;
}
