import { forwardRef, type TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea ref={ref} className={cn("min-h-32 w-full resize-y rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-950 transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100", className)} {...props} />
  ),
);
Textarea.displayName = "Textarea";
