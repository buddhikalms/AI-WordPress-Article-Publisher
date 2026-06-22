import type { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";

export default function FeatureCard({ icon: Icon, title, description }: { icon: LucideIcon; title: string; description: string }) {
  return <Card className="group h-full p-5 transition duration-300 hover:-translate-y-1 hover:border-blue-200 hover:shadow-[0_18px_50px_rgba(15,23,42,0.08)]"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-700 transition group-hover:bg-blue-600 group-hover:text-white"><Icon className="h-4 w-4" /></span><h3 className="mt-5 text-sm font-semibold text-slate-950">{title}</h3><p className="mt-2 text-xs leading-6 text-slate-600">{description}</p></Card>;
}
