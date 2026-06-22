import Link from "next/link";
import { PenTool } from "lucide-react";
import { cn } from "@/lib/utils";

export default function BrandLogo({ inverse = false }: { inverse?: boolean }) {
  return (
    <Link href="/" className="flex items-center gap-2.5" aria-label="AI Article Publisher home">
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white shadow-lg shadow-blue-600/20"><PenTool className="h-4 w-4" /></span>
      <span className={cn("text-sm font-bold tracking-[-0.02em]", inverse ? "text-white" : "text-slate-950")}>AI Article Publisher</span>
    </Link>
  );
}
