"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import ThemeToggle from "@/components/ThemeToggle";
import type { ReactNode, SVGProps } from "react";

type DashboardIcon =
  | "workspace"
  | "billing"
  | "sites"
  | "admin"
  | "users"
  | "settings"
  | "insights";

export type DashboardNavItem = {
  href: string;
  label: string;
  hint: string;
  visible?: boolean;
  group?: string;
  icon?: DashboardIcon;
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

type IconProps = SVGProps<SVGSVGElement> & {
  className?: string;
};

const isItemActive = (pathname: string, href: string) => {
  if (href === "/") {
    return pathname === "/";
  }
  return pathname === href || pathname.startsWith(`${href}/`);
};

const fallbackGroup = (href: string) => {
  if (href === "/") {
    return "Workspace";
  }
  if (href.startsWith("/billing")) {
    return "Revenue";
  }
  if (href.startsWith("/admin")) {
    return "Operations";
  }
  return "Settings";
};

const fallbackIcon = (href: string): DashboardIcon => {
  if (href === "/") {
    return "workspace";
  }
  if (href.startsWith("/billing")) {
    return "billing";
  }
  if (href.startsWith("/admin")) {
    return "admin";
  }
  if (href.startsWith("/account")) {
    return "sites";
  }
  return "settings";
};

function WorkspaceIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" {...props}>
      <rect x="3" y="4" width="14" height="12" rx="2.5" />
      <path d="M3 8h14" />
      <path d="M8 16V8" />
    </svg>
  );
}

function BillingIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" {...props}>
      <rect x="3" y="4" width="14" height="12" rx="2.5" />
      <path d="M3 8.5h14" />
      <path d="M7 12h2" />
      <path d="M11 12h2" />
    </svg>
  );
}

function SitesIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" {...props}>
      <path d="M4 16V7.5L10 4l6 3.5V16" />
      <path d="M2.5 16h15" />
      <path d="M8 16v-3h4v3" />
    </svg>
  );
}

function AdminIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" {...props}>
      <path d="M10 3.5 4.5 6.4v3.7c0 3.2 2.3 5.8 5.5 6.4 3.2-.6 5.5-3.2 5.5-6.4V6.4L10 3.5Z" />
      <path d="m8.2 10.1 1.2 1.2 2.4-2.5" />
    </svg>
  );
}

function UsersIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" {...props}>
      <path d="M6.5 9.2a2.7 2.7 0 1 0 0-5.4 2.7 2.7 0 0 0 0 5.4Z" />
      <path d="M13.5 10.2a2.2 2.2 0 1 0 0-4.4 2.2 2.2 0 0 0 0 4.4Z" />
      <path d="M2.8 16c.5-2.3 2.4-3.7 4.9-3.7S12 13.7 12.4 16" />
      <path d="M11.6 16c.3-1.6 1.5-2.6 3.3-2.6 1.6 0 2.6.8 3 2.6" />
    </svg>
  );
}

function SettingsIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" {...props}>
      <path d="M10 7.2a2.8 2.8 0 1 0 0 5.6 2.8 2.8 0 0 0 0-5.6Z" />
      <path d="m16.1 11.1-.8.5c-.2.1-.3.4-.2.6l.2.9a1 1 0 0 1-.7 1.2l-.9.2c-.2 0-.4.2-.5.4l-.4.8a1 1 0 0 1-1.3.4l-.8-.4a.8.8 0 0 0-.6 0l-.8.4a1 1 0 0 1-1.3-.4l-.4-.8a.7.7 0 0 0-.5-.4l-.9-.2a1 1 0 0 1-.7-1.2l.2-.9a.8.8 0 0 0-.2-.6l-.8-.5a1 1 0 0 1 0-1.4l.8-.5c.2-.1.3-.4.2-.6l-.2-.9a1 1 0 0 1 .7-1.2l.9-.2c.2 0 .4-.2.5-.4l.4-.8a1 1 0 0 1 1.3-.4l.8.4c.2.1.4.1.6 0l.8-.4a1 1 0 0 1 1.3.4l.4.8c.1.2.3.4.5.4l.9.2a1 1 0 0 1 .7 1.2l-.2.9a.8.8 0 0 0 .2.6l.8.5a1 1 0 0 1 0 1.4Z" />
    </svg>
  );
}

function InsightsIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" {...props}>
      <path d="M4 15.5V9.5" />
      <path d="M10 15.5V5.5" />
      <path d="M16 15.5v-3" />
      <path d="M2.5 15.5h15" />
    </svg>
  );
}

const iconMap: Record<DashboardIcon, (props: IconProps) => JSX.Element> = {
  workspace: WorkspaceIcon,
  billing: BillingIcon,
  sites: SitesIcon,
  admin: AdminIcon,
  users: UsersIcon,
  settings: SettingsIcon,
  insights: InsightsIcon,
};

const initialsFrom = (value: string) =>
  value
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("");

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
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement | null>(null);

  const visibleItems = navItems.filter((item) => item.visible !== false);
  const filteredItems = useMemo(
    () =>
      visibleItems.filter((item) => {
        if (!searchQuery.trim()) {
          return true;
        }

        const value = `${item.label} ${item.hint} ${item.group || ""}`.toLowerCase();
        return value.includes(searchQuery.toLowerCase());
      }),
    [searchQuery, visibleItems],
  );

  const groupedItems = useMemo(() => {
    const groups = new Map<string, DashboardNavItem[]>();

    for (const item of filteredItems) {
      const group = item.group || fallbackGroup(item.href);
      const collection = groups.get(group) || [];
      collection.push(item);
      groups.set(group, collection);
    }

    return [...groups.entries()];
  }, [filteredItems]);

  useEffect(() => {
    setIsSidebarOpen(false);
  }, [pathname]);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (!userMenuRef.current?.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };

    window.addEventListener("mousedown", handlePointerDown);
    return () => window.removeEventListener("mousedown", handlePointerDown);
  }, []);

  const sidebarContent = (
    <>
      <div className="rounded-2xl border border-slate-800 bg-slate-950 px-4 py-4 text-white">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
              AI Publisher
            </p>
            <p className="mt-1 text-sm font-semibold text-white">Agency Workspace</p>
          </div>
          <span className="badge border-white/10 bg-white/10 text-white">{role}</span>
        </div>
        <p className="mt-3 text-xs leading-5 text-slate-400">
          Compact publishing ops for content teams, editors, and client delivery.
        </p>
      </div>

      <div className="panel-muted mt-4 px-3 py-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
          Workspace Credit
        </p>
        <div className="mt-2 flex items-center justify-between gap-3">
          <p className="text-lg font-semibold text-slate-950">
            {typeof tokenBalance === "number" ? tokenBalance.toLocaleString() : "--"}
          </p>
          <span className="badge-info">Tokens</span>
        </div>
      </div>

      <div className="mt-4 space-y-4 overflow-y-auto pr-1">
        {groupedItems.map(([group, items]) => (
          <div key={group}>
            <p className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
              {group}
            </p>
            <div className="space-y-1.5">
              {items.map((item) => {
                const active = isItemActive(pathname, item.href);
                const Icon = iconMap[item.icon || fallbackIcon(item.href)];

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-start gap-3 rounded-2xl border px-3 py-2.5 transition ${
                      active
                        ? "border-blue-200 bg-blue-50 text-slate-950"
                        : "border-transparent bg-transparent text-slate-600 hover:border-slate-200 hover:bg-white hover:text-slate-950"
                    }`}
                  >
                    <span
                      className={`mt-0.5 rounded-xl border p-2 ${
                        active
                          ? "border-blue-200 bg-white text-blue-700"
                          : "border-slate-200 bg-slate-50 text-slate-500"
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-medium">{item.label}</span>
                      <span className="mt-0.5 block text-xs text-slate-500">{item.hint}</span>
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <button
        className="button-secondary mt-4 w-full"
        type="button"
        onClick={() => void signOut({ callbackUrl: "/login" })}
      >
        Sign out
      </button>
    </>
  );

  return (
    <div className="min-h-screen px-3 py-3 md:px-4 md:py-4">
      <div className="mx-auto flex w-full max-w-[1600px] gap-4">
        <aside className="sticky top-4 hidden h-[calc(100vh-2rem)] w-72 shrink-0 rounded-[28px] border border-slate-200/80 bg-white/75 p-4 shadow-[0_8px_30px_rgba(15,23,42,0.06)] backdrop-blur xl:block">
          {sidebarContent}
        </aside>

        {isSidebarOpen ? (
          <button
            type="button"
            aria-label="Close navigation"
            className="fixed inset-0 z-30 bg-slate-950/25 xl:hidden"
            onClick={() => setIsSidebarOpen(false)}
          />
        ) : null}

        <aside
          className={`fixed inset-y-0 left-0 z-40 w-[84vw] max-w-[320px] border-r border-slate-200 bg-white p-4 shadow-2xl transition-transform xl:hidden ${
            isSidebarOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          {sidebarContent}
        </aside>

        <div className="min-w-0 flex-1 space-y-4">
          <header className="panel flex flex-col gap-4 px-4 py-3 md:px-5">
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                className="button-muted xl:hidden"
                onClick={() => setIsSidebarOpen((current) => !current)}
              >
                <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-4 w-4">
                  <path d="M3 5h14" />
                  <path d="M3 10h14" />
                  <path d="M3 15h14" />
                </svg>
                Menu
              </button>

              <div className="relative min-w-[240px] flex-1">
                <svg
                  viewBox="0 0 20 20"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                >
                  <circle cx="9" cy="9" r="5.5" />
                  <path d="m13.5 13.5 3 3" />
                </svg>
                <input
                  className="input pl-9"
                  placeholder="Search pages"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                />
                {searchQuery.trim() ? (
                  <div className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-20 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl">
                    {filteredItems.length > 0 ? (
                      <div className="space-y-1">
                        {filteredItems.slice(0, 6).map((item) => (
                          <Link
                            key={item.href}
                            href={item.href}
                            className="block rounded-xl px-3 py-2 hover:bg-slate-50"
                            onClick={() => setSearchQuery("")}
                          >
                            <p className="text-sm font-medium text-slate-900">{item.label}</p>
                            <p className="text-xs text-slate-500">{item.hint}</p>
                          </Link>
                        ))}
                      </div>
                    ) : (
                      <p className="px-3 py-2 text-xs text-slate-500">No matching pages.</p>
                    )}
                  </div>
                ) : null}
              </div>

              <div className="hidden items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 sm:flex">
                <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                  Balance
                </span>
                <span className="text-sm font-semibold text-slate-950">
                  {typeof tokenBalance === "number" ? tokenBalance.toLocaleString() : "--"}
                </span>
              </div>

              <ThemeToggle />

              <div className="relative ml-auto" ref={userMenuRef}>
                <button
                  type="button"
                  className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-left hover:bg-slate-50"
                  onClick={() => setIsUserMenuOpen((current) => !current)}
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-slate-900 text-xs font-semibold text-white">
                    {initialsFrom(userLabel || userEmail || role)}
                  </span>
                  <span className="hidden sm:block">
                    <span className="block text-sm font-medium text-slate-950">{userLabel}</span>
                    <span className="block text-xs text-slate-500">{userEmail || role}</span>
                  </span>
                </button>

                {isUserMenuOpen ? (
                  <div className="absolute right-0 top-[calc(100%+0.5rem)] z-20 w-64 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl">
                    <div className="rounded-2xl bg-slate-50 px-3 py-3">
                      <p className="text-sm font-medium text-slate-950">{userLabel}</p>
                      <p className="mt-1 text-xs text-slate-500">{userEmail || "No email available"}</p>
                    </div>
                    <div className="mt-2 space-y-1">
                      {visibleItems.slice(0, 4).map((item) => (
                        <Link
                          key={item.href}
                          href={item.href}
                          className="block rounded-xl px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                          onClick={() => setIsUserMenuOpen(false)}
                        >
                          {item.label}
                        </Link>
                      ))}
                      <button
                        type="button"
                        className="button-danger w-full justify-start"
                        onClick={() => void signOut({ callbackUrl: "/login" })}
                      >
                        Sign out
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </header>

          <div className="page-header">
            <div className="section-header">
              <div className="min-w-0">
                <p className="eyebrow">{role === "ADMIN" ? "Operations" : "Dashboard"}</p>
                <h1 className="mt-1 text-lg font-semibold text-slate-950">{title}</h1>
                <p className="mt-1 max-w-3xl text-sm text-slate-500">{subtitle}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="badge-neutral">{role}</span>
                {typeof tokenBalance === "number" ? (
                  <span className="badge-info">{tokenBalance.toLocaleString()} tokens</span>
                ) : null}
              </div>
            </div>
          </div>

          <main className="animate-[fadeIn_.25s_ease-out] space-y-4">{children}</main>
        </div>
      </div>
    </div>
  );
}
