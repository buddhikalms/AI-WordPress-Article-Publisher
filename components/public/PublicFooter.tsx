import Link from "next/link";
import { Workflow } from "lucide-react";
import BrandLogo from "@/components/public/BrandLogo";

const groups = [
  ["Product", [["Features", "/features"], ["Integrations", "/integrations"], ["Pricing", "/pricing"]]],
  ["Solutions", [["Agencies", "/solutions"], ["Publishers", "/solutions"], ["Content teams", "/solutions"]]],
  ["Resources", [["Security", "/security"], ["Contact", "/contact"], ["Login", "/login"]]],
  ["Legal", [["Privacy", "/privacy"], ["Terms", "/terms"]]],
] as const;

export default function PublicFooter() {
  return (
    <footer className="border-t border-slate-800 bg-slate-950 text-slate-400">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.5fr_repeat(4,1fr)]">
          <div><BrandLogo inverse /><p className="mt-4 max-w-xs text-xs leading-6">Professional AI content operations for WordPress publishers, teams, and agencies.</p></div>
          {groups.map(([heading, links]) => <div key={heading}><p className="text-xs font-semibold text-white">{heading}</p><div className="mt-4 grid gap-3">{links.map(([label, href]) => <Link key={`${heading}-${label}`} href={href} className="text-[11px] transition hover:text-white">{label}</Link>)}</div></div>)}
        </div>
        <div className="mt-10 flex flex-col gap-3 border-t border-slate-800 pt-6 text-[10px] sm:flex-row sm:items-center sm:justify-between"><p>Copyright {new Date().getFullYear()} AI Article Publisher. All rights reserved.</p><p className="flex items-center gap-1.5"><Workflow className="h-3 w-3" />Built for serious WordPress publishing.</p></div>
      </div>
    </footer>
  );
}
