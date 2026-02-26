"use client";

import { useEffect } from "react";

type ToastType = "success" | "error" | "info";

interface StatusToastProps {
  message: string;
  type: ToastType;
  onClose: () => void;
}

const typeClass: Record<ToastType, string> = {
  success: "border-emerald-200 bg-emerald-50 text-emerald-900",
  error: "border-red-200 bg-red-50 text-red-900",
  info: "border-blue-200 bg-blue-50 text-blue-900",
};

export default function StatusToast({ message, type, onClose }: StatusToastProps) {
  useEffect(() => {
    const timer = setTimeout(onClose, 5000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div
      className={`fixed bottom-4 right-4 z-50 max-w-md rounded-lg border px-4 py-3 shadow ${typeClass[type]}`}
      role="status"
    >
      <div className="flex items-start justify-between gap-4">
        <p className="text-sm">{message}</p>
        <button
          type="button"
          onClick={onClose}
          className="text-xs font-semibold uppercase tracking-wide"
        >
          Close
        </button>
      </div>
    </div>
  );
}

