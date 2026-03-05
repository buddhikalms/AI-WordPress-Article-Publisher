"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import DashboardShell, { type DashboardNavItem } from "@/components/DashboardShell";

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

export default function BillingPage() {
  const router = useRouter();
  const { data: session, status } = useSession();

  const [tokenBalance, setTokenBalance] = useState<number>(0);
  const [role, setRole] = useState<"USER" | "ADMIN">("USER");
  const [packages, setPackages] = useState<PackageType[]>([]);
  const [purchases, setPurchases] = useState<PurchaseType[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [confirmingSessionId, setConfirmingSessionId] = useState<string | null>(null);
  const [confirmedSessionId, setConfirmedSessionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [checkoutStatus, setCheckoutStatus] = useState<string | null>(null);
  const [checkoutSessionId, setCheckoutSessionId] = useState<string | null>(null);

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
    if (checkoutStatus === "cancelled") {
      return "Checkout cancelled.";
    }
    return null;
  }, [checkoutSessionId, checkoutStatus, confirmedSessionId, confirmingSessionId]);

  const loadBillingData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [meRes, pkgRes] = await Promise.all([fetch("/api/me"), fetch("/api/packages")]);
      const mePayload = await meRes.json();
      const pkgPayload = await pkgRes.json();

      if (!meRes.ok) {
        throw new Error(mePayload?.error || "Failed to load billing data.");
      }
      if (!pkgRes.ok) {
        throw new Error(pkgPayload?.error || "Failed to load packages.");
      }

      setTokenBalance(mePayload.user.tokenBalance || 0);
      setRole(mePayload.user.role || "USER");
      setPurchases(mePayload.purchases || []);
      setPackages(pkgPayload.packages || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load billing.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login");
      return;
    }

    if (status !== "authenticated") {
      return;
    }

    void loadBillingData();
  }, [router, status, loadBillingData]);

  useEffect(() => {
    if (status !== "authenticated") {
      return;
    }

    if (checkoutStatus !== "success" || !checkoutSessionId) {
      return;
    }

    if (confirmedSessionId === checkoutSessionId || confirmingSessionId === checkoutSessionId) {
      return;
    }

    const confirmCheckout = async () => {
      try {
        setConfirmingSessionId(checkoutSessionId);
        const response = await fetch("/api/stripe/confirm", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            sessionId: checkoutSessionId,
          }),
        });
        const payload = await response.json();

        if (!response.ok) {
          throw new Error(payload?.error || "Failed to confirm payment.");
        }

        setConfirmedSessionId(checkoutSessionId);
        await loadBillingData();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to confirm payment.");
      } finally {
        setConfirmingSessionId(null);
      }
    };

    void confirmCheckout();
  }, [
    checkoutSessionId,
    checkoutStatus,
    confirmedSessionId,
    confirmingSessionId,
    loadBillingData,
    status,
  ]);

  const startCheckout = async (packageId: string) => {
    setError(null);
    try {
      setProcessingId(packageId);
      const response = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ packageId }),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload?.error || "Checkout failed.");
      }

      if (payload?.checkoutUrl) {
        window.location.href = payload.checkoutUrl;
        return;
      }

      throw new Error("Stripe checkout URL missing.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Checkout failed.");
    } finally {
      setProcessingId(null);
    }
  };

  if (status === "loading" || loading) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-8 text-sm text-slate-600">
        Loading billing...
      </main>
    );
  }

  return (
    <DashboardShell
      title="Billing & Packages"
      subtitle="Choose token packs, complete checkout, and track purchases."
      role={role}
      userLabel={session?.user?.name || session?.user?.email || "User"}
      userEmail={session?.user?.email || null}
      tokenBalance={tokenBalance}
      navItems={
        [
          { href: "/", label: "Dashboard", hint: "Generate and publish content" },
          { href: "/billing", label: "Billing", hint: "Packages and purchases" },
          { href: "/account", label: "Sites", hint: "Connected WordPress sites" },
          {
            href: "/admin",
            label: "Admin",
            hint: "Users and package management",
            visible: role === "ADMIN",
          },
        ] satisfies DashboardNavItem[]
      }
    >
      {statusMessage ? (
        <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
          {statusMessage}
        </div>
      ) : null}

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
          {error}
        </div>
      ) : null}

      <section className="grid gap-4 md:grid-cols-2">
        {packages.map((pkg) => (
          <article key={pkg.id} className="panel p-5">
            <h2 className="text-lg font-semibold text-slate-900">{pkg.name}</h2>
            <p className="mt-1 text-sm text-slate-600">
              {pkg.description || "Package credits for article generation."}
            </p>
            <p className="mt-3 text-2xl font-bold text-slate-900">
              {(pkg.priceCents / 100).toLocaleString(undefined, {
                style: "currency",
                currency: pkg.currency.toUpperCase(),
              })}
            </p>
            <p className="mt-1 text-sm text-slate-700">Tokens: {pkg.tokenAmount}</p>
            {pkg.featureList && pkg.featureList.length > 0 ? (
              <ul className="mt-2 list-disc pl-5 text-sm text-slate-600">
                {pkg.featureList.map((feature) => (
                  <li key={feature}>{feature}</li>
                ))}
              </ul>
            ) : null}
            <button
              type="button"
              className="button-primary mt-4 w-full"
              onClick={() => void startCheckout(pkg.id)}
              disabled={processingId === pkg.id}
            >
              {processingId === pkg.id ? "Redirecting..." : "Buy Package"}
            </button>
          </article>
        ))}
      </section>

      <section className="panel p-5">
        <h2 className="text-lg font-semibold text-slate-900">Recent Purchases</h2>
        {purchases.length === 0 ? (
          <p className="mt-2 text-sm text-slate-600">No purchases yet.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-slate-600">
                  <th className="px-2 py-2">Date</th>
                  <th className="px-2 py-2">Package</th>
                  <th className="px-2 py-2">Amount</th>
                  <th className="px-2 py-2">Tokens</th>
                </tr>
              </thead>
              <tbody>
                {purchases.map((purchase) => (
                  <tr className="border-b border-slate-100" key={purchase.id}>
                    <td className="px-2 py-2">{new Date(purchase.createdAt).toLocaleString()}</td>
                    <td className="px-2 py-2">{purchase.package?.name || "Package"}</td>
                    <td className="px-2 py-2">
                      {(purchase.amountCents / 100).toLocaleString(undefined, {
                        style: "currency",
                        currency: purchase.currency.toUpperCase(),
                      })}
                    </td>
                    <td className="px-2 py-2">{purchase.tokensGranted}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </DashboardShell>
  );
}
