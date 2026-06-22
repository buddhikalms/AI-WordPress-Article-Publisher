"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Menu, X } from "lucide-react";
import { useEffect, useState } from "react";
import BrandLogo from "@/components/public/BrandLogo";
import { cn } from "@/lib/utils";

const links = [
  ["Features", "/features"], ["Solutions", "/solutions"], ["Integrations", "/integrations"],
  ["Pricing", "/pricing"], ["Security", "/security"], ["Contact", "/contact"],
] as const;

export default function PublicHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [pathname]);

  return (
    <header className="public-header fixed inset-x-0 top-0 z-50 border-b border-slate-200/70 bg-white/90 shadow-[0_1px_18px_rgba(15,23,42,0.04)] backdrop-blur-xl">
      <div className="mx-auto flex h-[68px] max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <BrandLogo />
        <nav className="hidden items-center gap-1 lg:flex">
          {links.map(([label, href]) => (
            <Link key={href} href={href} className={cn("public-nav-link relative rounded-xl px-3 py-2 text-xs font-semibold transition", pathname === href ? "is-active bg-blue-50 text-blue-700" : "text-slate-600 hover:bg-slate-50 hover:text-slate-950")}>{label}</Link>
          ))}
        </nav>
        <div className="hidden items-center gap-2 lg:flex">
          <Link href="/login" className="public-login rounded-xl border border-transparent px-4 py-2.5 text-xs font-semibold text-slate-700 transition hover:border-slate-200 hover:bg-slate-50">Login</Link>
          <Link href="/register" className="public-cta rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-semibold text-white shadow-lg shadow-blue-600/15 transition hover:-translate-y-0.5 hover:bg-blue-700">Start Free</Link>
        </div>
        <button type="button" aria-label="Toggle navigation" aria-expanded={open} className="public-menu-button rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-slate-700 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 lg:hidden" onClick={() => setOpen((value) => !value)}>{open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}</button>
      </div>
      <AnimatePresence>
        {open ? (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="public-mobile-menu overflow-hidden border-t border-slate-200 bg-white shadow-xl lg:hidden">
            <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6">
              <nav className="grid gap-1">{links.map(([label, href]) => <Link key={href} href={href} className={cn("public-mobile-link rounded-xl px-3 py-3 text-sm font-semibold transition", pathname === href ? "is-active bg-blue-50 text-blue-700" : "text-slate-700 hover:bg-slate-50")}>{label}</Link>)}</nav>
              <div className="mt-4 grid grid-cols-2 gap-2 border-t border-slate-200 pt-4"><Link href="/login" className="public-login rounded-xl border border-slate-200 bg-white px-4 py-3 text-center text-xs font-semibold text-slate-700">Login</Link><Link href="/register" className="public-cta rounded-xl bg-blue-600 px-4 py-3 text-center text-xs font-semibold text-white">Start Free</Link></div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </header>
  );
}
