"use client";

import { useEffect } from "react";

type ToastType = "success" | "error" | "info";

interface StatusToastProps {
  message: string;
  type: ToastType;
  onClose: () => void;
}

const typeClass: Record<ToastType, string> = {
  success: "border-emerald-200 bg-white text-slate-900",
  error: "border-red-200 bg-white text-slate-900",
  info: "border-blue-200 bg-white text-slate-900",
};

const typeBadgeClass: Record<ToastType, string> = {
  success: "badge-success",
  error: "badge-error",
  info: "badge-info",
};

export default function StatusToast({ message, type, onClose }: StatusToastProps) {
  useEffect(() => {
    const timer = setTimeout(onClose, 4500);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div
      className={`fixed right-4 top-4 z-50 w-[min(420px,calc(100vw-2rem))] rounded-2xl border shadow-[0_20px_60px_rgba(15,23,42,0.15)] ${typeClass[type]}`}
      role="status"
    >
      <div className="flex items-start gap-3 px-4 py-3">
        <div className={`shrink-0 ${typeBadgeClass[type]}`}>{type}</div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium leading-6 text-slate-900">{message}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
          aria-label="Close toast"
        >
          <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
            <path d="m5 5 10 10" />
            <path d="M15 5 5 15" />
          </svg>
        </button>
      </div>
    </div>
  );
}
