"use client";

import { FormEvent, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import DashboardShell, { type DashboardNavItem } from "@/components/DashboardShell";

type AdminUser = {
  id: string;
  name: string | null;
  email: string | null;
  role: "USER" | "ADMIN";
  emailVerified: string | null;
  tokenBalance: number;
  createdAt: string;
  deviceRegistration: {
    deviceId: string;
    lastSeenAt: string;
  } | null;
  wordpressSites: Array<{
    id: string;
    name: string;
    baseUrl: string;
    username: string;
    updatedAt: string;
    isDefault: boolean;
  }>;
  _count: {
    wordpressSites: number;
  };
};

type AdminPackage = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  featureList: string[] | null;
  priceCents: number;
  currency: string;
  tokenAmount: number;
  stripePriceId: string | null;
  isActive: boolean;
};

type EditablePackageState = {
  id: string;
  name: string;
  slug: string;
  description: string;
  featureList: string;
  priceCents: number;
  currency: string;
  tokenAmount: number;
  stripePriceId: string;
  isActive: boolean;
};

export default function AdminPage() {
  const router = useRouter();
  const { data: session, status } = useSession();

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [packages, setPackages] = useState<AdminPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [pkgName, setPkgName] = useState("");
  const [pkgSlug, setPkgSlug] = useState("");
  const [pkgDescription, setPkgDescription] = useState("");
  const [pkgFeatures, setPkgFeatures] = useState("");
  const [pkgPriceCents, setPkgPriceCents] = useState(9900);
  const [pkgCurrency, setPkgCurrency] = useState("usd");
  const [pkgTokenAmount, setPkgTokenAmount] = useState(100);
  const [pkgStripePriceId, setPkgStripePriceId] = useState("");
  const [editingPackage, setEditingPackage] = useState<EditablePackageState | null>(
    null,
  );
  const [updatingPackage, setUpdatingPackage] = useState(false);
  const [deletingPackageId, setDeletingPackageId] = useState<string | null>(null);

  const [adjustUserId, setAdjustUserId] = useState("");
  const [adjustAmount, setAdjustAmount] = useState(0);
  const [adjustNote, setAdjustNote] = useState("");

  const parseFeatureList = (value: string) =>
    value
      .split(",")
      .map((feature) => feature.trim())
      .filter(Boolean);

  const loadData = async () => {
    setLoading(true);
    setError(null);

    try {
      const [usersRes, packagesRes] = await Promise.all([
        fetch("/api/admin/users"),
        fetch("/api/admin/packages"),
      ]);

      const usersPayload = await usersRes.json();
      const packagesPayload = await packagesRes.json();

      if (!usersRes.ok) {
        throw new Error(usersPayload?.error || "Failed to load users.");
      }
      if (!packagesRes.ok) {
        throw new Error(packagesPayload?.error || "Failed to load packages.");
      }

      setUsers(usersPayload.users || []);
      setPackages(packagesPayload.packages || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load admin data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login");
      return;
    }

    if (status === "authenticated") {
      if (session?.user?.role !== "ADMIN") {
        router.replace("/");
        return;
      }
      void loadData();
    }
  }, [router, session?.user?.role, status]);

  const handleCreatePackage = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setMessage(null);

    try {
      const response = await fetch("/api/admin/packages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: pkgName,
          slug: pkgSlug,
          description: pkgDescription || undefined,
          featureList: parseFeatureList(pkgFeatures),
          priceCents: Number(pkgPriceCents),
          currency: pkgCurrency,
          tokenAmount: Number(pkgTokenAmount),
          stripePriceId: pkgStripePriceId || undefined,
          isActive: true,
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || "Failed to create package.");
      }

      setMessage("Package created successfully.");
      setPkgName("");
      setPkgSlug("");
      setPkgDescription("");
      setPkgFeatures("");
      setPkgPriceCents(9900);
      setPkgCurrency("usd");
      setPkgTokenAmount(100);
      setPkgStripePriceId("");
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create package.");
    }
  };

  const handleAdjustTokens = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setMessage(null);

    try {
      const response = await fetch("/api/admin/tokens", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: adjustUserId,
          amount: Number(adjustAmount),
          description: adjustNote || undefined,
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || "Failed to adjust tokens.");
      }

      setMessage("Token balance updated.");
      setAdjustAmount(0);
      setAdjustNote("");
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to adjust tokens.");
    }
  };

  const startEditingPackage = (pkg: AdminPackage) => {
    setEditingPackage({
      id: pkg.id,
      name: pkg.name,
      slug: pkg.slug,
      description: pkg.description || "",
      featureList: (pkg.featureList || []).join(", "),
      priceCents: pkg.priceCents,
      currency: pkg.currency,
      tokenAmount: pkg.tokenAmount,
      stripePriceId: pkg.stripePriceId || "",
      isActive: pkg.isActive,
    });
    setMessage(null);
    setError(null);
  };

  const handleUpdatePackage = async (event: FormEvent) => {
    event.preventDefault();
    if (!editingPackage) {
      return;
    }

    setError(null);
    setMessage(null);

    try {
      setUpdatingPackage(true);
      const response = await fetch("/api/admin/packages", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: editingPackage.id,
          name: editingPackage.name,
          slug: editingPackage.slug,
          description: editingPackage.description || undefined,
          featureList: parseFeatureList(editingPackage.featureList),
          priceCents: Number(editingPackage.priceCents),
          currency: editingPackage.currency,
          tokenAmount: Number(editingPackage.tokenAmount),
          stripePriceId: editingPackage.stripePriceId || undefined,
          isActive: editingPackage.isActive,
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || "Failed to update package.");
      }

      setMessage("Package updated successfully.");
      setEditingPackage(null);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update package.");
    } finally {
      setUpdatingPackage(false);
    }
  };

  const handleDeletePackage = async (pkg: AdminPackage) => {
    const confirmed = window.confirm(
      `Delete package "${pkg.name}"? This action cannot be undone.`,
    );

    if (!confirmed) {
      return;
    }

    setError(null);
    setMessage(null);

    try {
      setDeletingPackageId(pkg.id);
      const response = await fetch("/api/admin/packages", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: pkg.id,
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || "Failed to delete package.");
      }

      if (editingPackage?.id === pkg.id) {
        setEditingPackage(null);
      }

      setMessage(payload?.message || "Package deleted.");
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete package.");
    } finally {
      setDeletingPackageId(null);
    }
  };

  if (status === "loading" || loading) {
    return (
      <main className="mx-auto max-w-7xl px-4 py-8 text-sm text-slate-600">
        Loading admin panel...
      </main>
    );
  }

  return (
    <DashboardShell
      title="Admin Dashboard"
      subtitle="Manage users, package pricing, and token operations."
      role="ADMIN"
      userLabel={session?.user?.name || session?.user?.email || "Admin"}
      userEmail={session?.user?.email || null}
      tokenBalance={null}
      navItems={
        [
          { href: "/admin", label: "Admin", hint: "Platform administration" },
          { href: "/", label: "User Dashboard", hint: "Content operations" },
          { href: "/billing", label: "Billing", hint: "Customer packages" },
          { href: "/account", label: "Account", hint: "Your profile settings" },
        ] satisfies DashboardNavItem[]
      }
    >
      {message ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          {message}
        </div>
      ) : null}
      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
          {error}
        </div>
      ) : null}

      <section className="panel p-5">
        <h2 className="text-lg font-semibold text-slate-900">Create Package</h2>
        <p className="mt-2 text-sm text-slate-600">
          Add package details below. Leave Stripe Price ID empty to auto-create a matching one-time
          Stripe price.
        </p>
        <form className="mt-4 grid gap-3 md:grid-cols-2" onSubmit={handleCreatePackage}>
          <div>
            <label className="label">Package Name</label>
            <input
              className="input"
              title="Enter package display name"
              placeholder="Starter Pack"
              value={pkgName}
              onChange={(event) => setPkgName(event.target.value)}
              required
            />
          </div>
          <div>
            <label className="label">Slug</label>
            <input
              className="input"
              title="Enter URL-safe package slug"
              placeholder="starter-pack"
              value={pkgSlug}
              onChange={(event) => setPkgSlug(event.target.value)}
              required
            />
          </div>
          <div className="md:col-span-2">
            <label className="label">Description</label>
            <input
              className="input"
              title="Describe what this package provides"
              placeholder="Best for first-time users."
              value={pkgDescription}
              onChange={(event) => setPkgDescription(event.target.value)}
            />
          </div>
          <div className="md:col-span-2">
            <label className="label">Features (comma separated)</label>
            <input
              className="input"
              title="Enter package feature list separated by commas"
              placeholder="Fast generation, priority support"
              value={pkgFeatures}
              onChange={(event) => setPkgFeatures(event.target.value)}
            />
          </div>
          <div>
            <label className="label">Price (Cents)</label>
            <input
              className="input"
              type="number"
              title="Enter package price in cents"
              placeholder="9900"
              value={pkgPriceCents}
              onChange={(event) => setPkgPriceCents(Number(event.target.value))}
              required
            />
          </div>
          <div>
            <label className="label">Currency</label>
            <input
              className="input"
              title="Enter 3-letter currency code"
              placeholder="usd"
              value={pkgCurrency}
              onChange={(event) => setPkgCurrency(event.target.value)}
              required
            />
          </div>
          <div>
            <label className="label">Token Amount</label>
            <input
              className="input"
              type="number"
              title="Enter number of tokens granted for this package"
              placeholder="100"
              value={pkgTokenAmount}
              onChange={(event) => setPkgTokenAmount(Number(event.target.value))}
              required
            />
          </div>
          <div>
            <label className="label">Stripe Price ID (optional)</label>
            <input
              className="input"
              placeholder="price_..."
              value={pkgStripePriceId}
              onChange={(event) => setPkgStripePriceId(event.target.value)}
              pattern="^price_[A-Za-z0-9]+$"
              title="Use a Stripe Price ID, for example price_1ABC..."
            />
          </div>
          <button className="button-primary md:col-span-2" type="submit">
            Create package
          </button>
        </form>
      </section>

      {editingPackage ? (
        <section className="panel p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold text-slate-900">Edit Package</h2>
            <button
              type="button"
              className="button-muted"
              onClick={() => setEditingPackage(null)}
              disabled={updatingPackage}
            >
              Cancel
            </button>
          </div>
          <form className="mt-4 grid gap-3 md:grid-cols-2" onSubmit={handleUpdatePackage}>
            <div>
              <label className="label">Package Name</label>
              <input
                className="input"
                title="Enter package display name"
                placeholder="Starter Pack"
                value={editingPackage.name}
                onChange={(event) =>
                  setEditingPackage((current) =>
                    current ? { ...current, name: event.target.value } : current,
                  )
                }
                required
              />
            </div>
            <div>
              <label className="label">Slug</label>
              <input
                className="input"
                title="Enter URL-safe package slug"
                placeholder="starter-pack"
                value={editingPackage.slug}
                onChange={(event) =>
                  setEditingPackage((current) =>
                    current ? { ...current, slug: event.target.value } : current,
                  )
                }
                required
              />
            </div>
            <div className="md:col-span-2">
              <label className="label">Description</label>
              <input
                className="input"
                title="Describe what this package provides"
                placeholder="Best for first-time users."
                value={editingPackage.description}
                onChange={(event) =>
                  setEditingPackage((current) =>
                    current ? { ...current, description: event.target.value } : current,
                  )
                }
              />
            </div>
            <div className="md:col-span-2">
              <label className="label">Features (comma separated)</label>
              <input
                className="input"
                title="Enter package feature list separated by commas"
                placeholder="Fast generation, priority support"
                value={editingPackage.featureList}
                onChange={(event) =>
                  setEditingPackage((current) =>
                    current ? { ...current, featureList: event.target.value } : current,
                  )
                }
              />
            </div>
            <div>
              <label className="label">Price (Cents)</label>
              <input
                className="input"
                type="number"
                title="Enter package price in cents"
                placeholder="9900"
                value={editingPackage.priceCents}
                onChange={(event) =>
                  setEditingPackage((current) =>
                    current
                      ? { ...current, priceCents: Number(event.target.value) || 0 }
                      : current,
                  )
                }
                required
              />
            </div>
            <div>
              <label className="label">Currency</label>
              <input
                className="input"
                title="Enter 3-letter currency code"
                placeholder="usd"
                value={editingPackage.currency}
                onChange={(event) =>
                  setEditingPackage((current) =>
                    current ? { ...current, currency: event.target.value } : current,
                  )
                }
                required
              />
            </div>
            <div>
              <label className="label">Token Amount</label>
              <input
                className="input"
                type="number"
                title="Enter number of tokens granted for this package"
                placeholder="100"
                value={editingPackage.tokenAmount}
                onChange={(event) =>
                  setEditingPackage((current) =>
                    current
                      ? { ...current, tokenAmount: Number(event.target.value) || 0 }
                      : current,
                  )
                }
                required
              />
            </div>
            <div>
              <label className="label">Stripe Price ID (optional)</label>
              <input
                className="input"
                placeholder="price_..."
                value={editingPackage.stripePriceId}
                onChange={(event) =>
                  setEditingPackage((current) =>
                    current ? { ...current, stripePriceId: event.target.value } : current,
                  )
                }
                pattern="^price_[A-Za-z0-9]+$"
                title="Use a Stripe Price ID, for example price_1ABC..."
              />
            </div>
            <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-700 md:col-span-2">
              <input
                type="checkbox"
                title="Toggle package availability"
                checked={editingPackage.isActive}
                onChange={(event) =>
                  setEditingPackage((current) =>
                    current ? { ...current, isActive: event.target.checked } : current,
                  )
                }
              />
              Package active
            </label>
            <button className="button-primary md:col-span-2" type="submit" disabled={updatingPackage}>
              {updatingPackage ? "Saving changes..." : "Save changes"}
            </button>
          </form>
        </section>
      ) : null}

      <section className="panel p-5">
        <h2 className="text-lg font-semibold text-slate-900">Adjust User Tokens</h2>
        <p className="mt-2 text-sm text-slate-600">
          Use positive numbers to add tokens and negative numbers to deduct tokens.
        </p>
        <form className="mt-4 grid gap-3 md:grid-cols-3" onSubmit={handleAdjustTokens}>
          <div>
            <label className="label">User</label>
            <select
              className="select"
              title="Select the user account to adjust"
              value={adjustUserId}
              onChange={(event) => setAdjustUserId(event.target.value)}
              required
            >
              <option value="">Select user</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.email || user.name || user.id} ({user.tokenBalance})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Amount</label>
            <input
              className="input"
              type="number"
              title="Enter token adjustment amount, for example +50 or -20"
              value={adjustAmount}
              onChange={(event) => setAdjustAmount(Number(event.target.value))}
              placeholder="+50 or -20"
              required
            />
          </div>
          <div>
            <label className="label">Note (optional)</label>
            <input
              className="input"
              title="Add an internal reason for this token adjustment"
              value={adjustNote}
              onChange={(event) => setAdjustNote(event.target.value)}
              placeholder="Adjustment note"
            />
          </div>
          <button className="button-primary md:col-span-3" type="submit">
            Apply token adjustment
          </button>
        </form>
      </section>

      <section className="panel p-5">
        <h2 className="text-lg font-semibold text-slate-900">Packages</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-slate-600">
                <th className="px-2 py-2">Name</th>
                <th className="px-2 py-2">Price</th>
                <th className="px-2 py-2">Tokens</th>
                <th className="px-2 py-2">Stripe Price</th>
                <th className="px-2 py-2">Status</th>
                <th className="px-2 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {packages.map((pkg) => (
                <tr key={pkg.id} className="border-b border-slate-100">
                  <td className="px-2 py-2">{pkg.name}</td>
                  <td className="px-2 py-2">
                    {(pkg.priceCents / 100).toLocaleString(undefined, {
                      style: "currency",
                      currency: pkg.currency.toUpperCase(),
                    })}
                  </td>
                  <td className="px-2 py-2">{pkg.tokenAmount}</td>
                  <td className="px-2 py-2">{pkg.stripePriceId || "-"}</td>
                  <td className="px-2 py-2">{pkg.isActive ? "Active" : "Inactive"}</td>
                  <td className="px-2 py-2">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="button-muted"
                        onClick={() => startEditingPackage(pkg)}
                        disabled={deletingPackageId === pkg.id}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="button border border-red-300 bg-red-50 text-red-700 hover:bg-red-100"
                        onClick={() => void handleDeletePackage(pkg)}
                        disabled={deletingPackageId === pkg.id}
                      >
                        {deletingPackageId === pkg.id ? "Deleting..." : "Delete"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel p-5">
        <h2 className="text-lg font-semibold text-slate-900">Users</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-slate-600">
                <th className="px-2 py-2">Email</th>
                <th className="px-2 py-2">Role</th>
                <th className="px-2 py-2">Tokens</th>
                <th className="px-2 py-2">Verified</th>
                <th className="px-2 py-2">WordPress</th>
                <th className="px-2 py-2">Device</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-b border-slate-100">
                  <td className="px-2 py-2">{user.email || "-"}</td>
                  <td className="px-2 py-2">{user.role}</td>
                  <td className="px-2 py-2">{user.tokenBalance}</td>
                  <td className="px-2 py-2">{user.emailVerified ? "Yes" : "No"}</td>
                  <td className="px-2 py-2">
                    {user.wordpressSites[0]?.baseUrl || "-"}
                    {user._count.wordpressSites > 1
                      ? ` (+${user._count.wordpressSites - 1} more)`
                      : ""}
                  </td>
                  <td className="px-2 py-2">
                    {user.deviceRegistration?.deviceId.slice(0, 12) || "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </DashboardShell>
  );
}
