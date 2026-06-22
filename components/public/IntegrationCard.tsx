import type { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";

export default function IntegrationCard({ icon: Icon, name, category, description }: { icon: LucideIcon; name: string; category: string; description: string }) {
  return <Card className="h-full p-5"><div className="flex items-start justify-between"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-950 text-white"><Icon className="h-4 w-4" /></span><span className="rounded-full bg-blue-50 px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider text-blue-700">{category}</span></div><h3 className="mt-5 text-sm font-semibold text-slate-950">{name}</h3><p className="mt-2 text-xs leading-6 text-slate-600">{description}</p></Card>;
}
