"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { signOut, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import DashboardLoadError from "@/components/DashboardLoadError";
import DashboardLoading from "@/components/DashboardLoading";
import DashboardShell, { type DashboardNavItem } from "@/components/DashboardShell";
import EmptyState from "@/components/EmptyState";
import PaginationControls from "@/components/PaginationControls";
import StatusToast from "@/components/StatusToast";

type PackageType = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  featureList: string[] | null;
  priceCents: number;
  currency: string;
  tokenAmount: number;
};

type PurchaseType = {
  id: string;
  status: string;
  amountCents: number;
  currency: string;
  tokensGranted: number;
  createdAt: string;
  package: {
    id: string;
    name: string;
    tokenAmount: number;
    priceCents: number;
    currency: string;
  };
};

const PAGE_SIZE = 6;

export default function BillingPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [tokenBalance, setTokenBalance] = useState(0);
  const [role, setRole] = useState<"USER" | "ADMIN">("USER");
  const [packages, setPackages] = useState<PackageType[]>([]);
  const [purchases, setPurchases] = useState<PurchaseType[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [confirmingSessionId, setConfirmingSessionId] = useState<string | null>(null);
  const [confirmedSessionId, setConfirmedSessionId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: "success" | "error" | "info"; message: string } | null>(null);
  const [checkoutStatus, setCheckoutStatus] = useState<string | null>(null);
  const [checkoutSessionId, setCheckoutSessionId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setCheckoutStatus(params.get("status"));
    setCheckoutSessionId(params.get("session_id"));
  }, []);

  const statusMessage = useMemo(() => {
    if (checkoutStatus === "success") {
      if (confirmingSessionId || confirmedSessionId !== checkoutSessionId) {
        return "Payment successful. Finalizing token credit...";
      }
      return "Payment successful. Tokens were added to your account.";
    }
    if (checkoutStatus === "cancelled") return "Checkout cancelled.";
    return null;
  }, [checkoutSessionId, checkoutStatus, confirmedSessionId, confirmingSessionId]);

  const loadBillingData = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [meRes, pkgRes] = await Promise.all([fetch("/api/me"), fetch("/api/packages")]);
      const mePayload = await meRes.json();
      const pkgPayload = await pkgRes.json();
      if (!meRes.ok) throw new Error(mePayload?.error || "Failed to load billing data.");
      if (!pkgRes.ok) throw new Error(pkgPayload?.error || "Failed to load packages.");
      setTokenBalance(mePayload.user.tokenBalance || 0);
      setRole(mePayload.user.role || "USER");
      setPurchases(mePayload.purchases || []);
      setPackages(pkgPayload.packages || []);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load billing.";
      setLoadError(message);
      setToast({
        type: "error",
        message,
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login");
      return;
    }
    if (status !== "authenticated") return;
    void loadBillingData();
  }, [router, status, loadBillingData]);

  useEffect(() => {
    if (status !== "authenticated") return;
    if (checkoutStatus !== "success" || !checkoutSessionId) return;
    if (confirmedSessionId === checkoutSessionId || confirmingSessionId === checkoutSessionId) return;

    const confirmCheckout = async () => {
      try {
        setConfirmingSessionId(checkoutSessionId);
        const response = await fetch("/api/stripe/confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId: checkoutSessionId }),
        });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload?.error || "Failed to confirm payment.");
        setConfirmedSessionId(checkoutSessionId);
        await loadBillingData();
      } catch (err) {
        setToast({
          type: "error",
          message: err instanceof Error ? err.message : "Failed to confirm payment.",
        });
      } finally {
        setConfirmingSessionId(null);
      }
    };

    void confirmCheckout();
  }, [checkoutSessionId, checkoutStatus, confirmedSessionId, confirmingSessionId, loadBillingData, status]);

  const startCheckout = async (packageId: string) => {
    try {
      setProcessingId(packageId);
      const response = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packageId }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || "Checkout failed.");
      if (!payload?.checkoutUrl) throw new Error("Stripe checkout URL missing.");
      window.location.href = payload.checkoutUrl;
    } catch (err) {
      setToast({
        type: "error",
        message: err instanceof Error ? err.message : "Checkout failed.",
      });
    } finally {
      setProcessingId(null);
    }
  };

  const filteredPurchases = purchases.filter((purchase) => {
    const matchesSearch = `${purchase.package?.name || ""} ${purchase.status}`
      .toLowerCase()
      .includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || purchase.status.toLowerCase() === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totalPages = Math.max(1, Math.ceil(filteredPurchases.length / PAGE_SIZE));
  const pagedPurchases = filteredPurchases.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => {
    setPage((current) => Math.min(current, totalPages));
  }, [totalPages]);

  if (status === "loading" || loading) return <DashboardLoading title="Loading billing..." />;
  if (loadError && packages.length === 0 && purchases.length === 0) {
    return (
      <DashboardLoadError
        title="Unable to open billing"
        message={loadError}
        onRetry={() => void loadBillingData()}
        onSignOut={() => void signOut({ callbackUrl: "/login" })}
      />
    );
  }

  return (
    <DashboardShell
      title="Billing & Packages"
      subtitle="Choose token packs, complete checkout, and track purchases from a cleaner revenue dashboard."
      role={role}
      userLabel={session?.user?.name || session?.user?.email || "User"}
      userEmail={session?.user?.email || null}
      tokenBalance={tokenBalance}
      navItems={
        [
          { href: "/app/dashboard", label: "Workspace", hint: "Generate and publish content", group: "Workspace", icon: "workspace" },
          { href: "/billing", label: "Billing", hint: "Packages and purchases", group: "Revenue", icon: "billing" },
          { href: "/account", label: "Sites", hint: "Connected WordPress sites", group: "Settings", icon: "sites" },
          { href: "/admin", label: "Admin", hint: "Users and package management", visible: role === "ADMIN", group: "Operations", icon: "admin" },
        ] satisfies DashboardNavItem[]
      }
    >
      {statusMessage ? (
        <div className="panel px-4 py-4 md:px-5">
          <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">{statusMessage}</div>
        </div>
      ) : null}

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.05fr)_420px]">
        <div className="space-y-4">
          <section className="panel px-4 py-4 md:px-5">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="panel-muted px-4 py-4">
                <p className="eyebrow">Token Balance</p>
                <p className="mt-2 text-xl font-semibold text-slate-950">{tokenBalance.toLocaleString()}</p>
                <p className="mt-1 text-xs text-slate-500">Available credits for draft, image, and publish workflows.</p>
              </div>
              <div className="panel-muted px-4 py-4">
                <p className="eyebrow">Packages</p>
                <p className="mt-2 text-xl font-semibold text-slate-950">{packages.length}</p>
                <p className="mt-1 text-xs text-slate-500">Curated plans designed for agencies and repeat publishing teams.</p>
              </div>
              <div className="panel-muted px-4 py-4">
                <p className="eyebrow">Purchases</p>
                <p className="mt-2 text-xl font-semibold text-slate-950">{purchases.length}</p>
                <p className="mt-1 text-xs text-slate-500">Recent checkout history with package and token detail.</p>
              </div>
            </div>
          </section>

          <section className="panel px-4 py-4 md:px-5">
            <div className="section-header">
              <div>
                <p className="eyebrow">Plans</p>
                <h2 className="mt-1 text-sm font-semibold text-slate-950">Available token packages</h2>
              </div>
            </div>
            <div className="mt-4 grid gap-3 lg:grid-cols-2">
              {packages.map((pkg) => (
                <article key={pkg.id} className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-950">{pkg.name}</p>
                      <p className="mt-1 text-xs leading-5 text-slate-500">{pkg.description || "Package credits for article generation."}</p>
                    </div>
                    <span className="badge-info">{pkg.tokenAmount} tokens</span>
                  </div>
                  <p className="mt-4 text-xl font-semibold text-slate-950">
                    {(pkg.priceCents / 100).toLocaleString(undefined, { style: "currency", currency: pkg.currency.toUpperCase() })}
                  </p>
                  {pkg.featureList && pkg.featureList.length > 0 ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {pkg.featureList.map((feature) => (
                        <span key={feature} className="badge-neutral">{feature}</span>
                      ))}
                    </div>
                  ) : null}
                  <button type="button" className="button-primary mt-4 w-full" onClick={() => void startCheckout(pkg.id)} disabled={processingId === pkg.id}>
                    {processingId === pkg.id ? "Redirecting..." : "Buy package"}
                  </button>
                </article>
              ))}
            </div>
          </section>
        </div>

        <section className="panel overflow-hidden">
          <div className="px-4 py-4 md:px-5">
            <div className="section-header">
              <div>
                <p className="eyebrow">Purchase History</p>
                <h2 className="mt-1 text-sm font-semibold text-slate-950">Recent purchases</h2>
              </div>
            </div>
          </div>

          <div className="table-toolbar">
            <input className="input md:max-w-xs" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by package or status" />
            <select className="select md:max-w-[180px]" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="all">All statuses</option>
              <option value="paid">Paid</option>
              <option value="pending">Pending</option>
              <option value="failed">Failed</option>
              <option value="complete">Complete</option>
            </select>
          </div>

          {filteredPurchases.length === 0 ? (
            <div className="px-4 pb-4 md:px-5">
              <EmptyState title="No purchases found" description="Once a checkout completes, it will appear here with amount and token detail." />
            </div>
          ) : (
            <>
              <div className="table-scroll">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Package</th>
                      <th>Status</th>
                      <th>Amount</th>
                      <th>Tokens</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagedPurchases.map((purchase) => (
                      <tr key={purchase.id}>
                        <td>{new Date(purchase.createdAt).toLocaleString()}</td>
                        <td className="font-medium text-slate-900">{purchase.package?.name || "Package"}</td>
                        <td>
                          <span className={purchase.status.toLowerCase() === "paid" || purchase.status.toLowerCase() === "complete" ? "badge-success" : purchase.status.toLowerCase() === "failed" ? "badge-error" : "badge-warning"}>
                            {purchase.status}
                          </span>
                        </td>
                        <td>{(purchase.amountCents / 100).toLocaleString(undefined, { style: "currency", currency: purchase.currency.toUpperCase() })}</td>
                        <td>{purchase.tokensGranted}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <PaginationControls page={page} totalPages={totalPages} onPageChange={setPage} label="Purchases" />
            </>
          )}
        </section>
      </section>

      {toast ? <StatusToast type={toast.type} message={toast.message} onClose={() => setToast(null)} /> : null}
    </DashboardShell>
  );
}
