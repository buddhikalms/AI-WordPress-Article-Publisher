import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm";
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-xl text-xs font-semibold transition focus-visible:ring-4 focus-visible:ring-blue-100 disabled:pointer-events-none disabled:opacity-55",
        size === "sm" ? "h-9 px-3" : "h-11 px-4",
        variant === "default" && "bg-blue-600 text-white shadow-sm hover:bg-blue-700",
        variant === "outline" && "border border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50",
        variant === "ghost" && "text-slate-600 hover:bg-slate-100 hover:text-slate-950",
        className,
      )}
      {...props}
    />
  ),
);
Button.displayName = "Button";
