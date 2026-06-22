import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input ref={ref} className={cn("h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-950 transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100", className)} {...props} />
  ),
);
Input.displayName = "Input";
