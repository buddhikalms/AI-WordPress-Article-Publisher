"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import type { ReactNode } from "react";

export type DashboardNavItem = {
  href: string;
  label: string;
  hint: string;
  visible?: boolean;
};

type DashboardShellProps = {
  title: string;
  subtitle: string;
  role: "USER" | "ADMIN";
  userLabel: string;
  userEmail?: string | null;
  tokenBalance?: number | null;
  navItems: DashboardNavItem[];
  children: ReactNode;
};

const isItemActive = (pathname: string, href: string) => {
  if (href === "/") {
    return pathname === "/";
  }
  return pathname === href || pathname.startsWith(`${href}/`);
};

export default function DashboardShell({
  title,
  subtitle,
  role,
  userLabel,
  userEmail,
  tokenBalance,
  navItems,
  children,
}: DashboardShellProps) {
  const pathname = usePathname();
  const visibleItems = navItems.filter((item) => item.visible !== false);

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_right,_#cde8ff,_#f8fafc_40%,_#dbe7f4_100%)] px-3 py-3 md:px-6 md:py-6">
      <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-4 lg:flex-row">
        <aside className="w-full shrink-0 rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-lg backdrop-blur lg:sticky lg:top-6 lg:h-[calc(100vh-3rem)] lg:w-72 lg:p-5">
          <div className="rounded-xl border border-slate-200 bg-gradient-to-br from-slate-900 to-slate-700 px-4 py-4 text-white">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-300">
              AI Publisher
            </p>
            <p className="mt-2 text-lg font-semibold leading-tight">
              Professional Workspace
            </p>
            <p className="mt-3 text-xs text-slate-300">Role: {role}</p>
          </div>

          <nav className="mt-4 space-y-2">
            {visibleItems.map((item) => {
              const active = isItemActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`block rounded-xl border px-3 py-2 transition ${
                    active
                      ? "border-blue-300 bg-blue-50 shadow-sm"
                      : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  <p className="text-sm font-semibold text-slate-900">{item.label}</p>
                  <p className="text-xs text-slate-600">{item.hint}</p>
                </Link>
              );
            })}
          </nav>

          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
            <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Token Balance</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">
              {typeof tokenBalance === "number" ? tokenBalance.toLocaleString() : "-"}
            </p>
          </div>

          <button
            className="button-secondary mt-4 w-full"
            type="button"
            onClick={() => void signOut({ callbackUrl: "/login" })}
          >
            Sign out
          </button>
        </aside>

        <div className="flex-1 space-y-4">
          <header className="rounded-2xl border border-slate-200 bg-white/95 px-5 py-4 shadow-sm backdrop-blur md:px-6 md:py-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
                <p className="mt-1 text-sm text-slate-600">{subtitle}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-right">
                <p className="text-sm font-semibold text-slate-900">{userLabel}</p>
                <p className="text-xs text-slate-600">{userEmail || "No email available"}</p>
              </div>
            </div>
          </header>

          <div className="animate-[fadeIn_.35s_ease-out] space-y-5">{children}</div>
        </div>
      </div>
    </div>
  );
}
