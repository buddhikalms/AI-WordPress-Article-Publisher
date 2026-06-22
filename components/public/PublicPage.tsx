"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";
import PublicHeader from "@/components/public/PublicHeader";
import PublicFooter from "@/components/public/PublicFooter";

export default function PublicPage({ children }: { children: ReactNode }) {
  const reduce = useReducedMotion();
  return <div className="marketing-page min-h-screen bg-white text-slate-950"><PublicHeader /><motion.main initial={reduce ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.38 }}>{children}</motion.main><PublicFooter /></div>;
}
