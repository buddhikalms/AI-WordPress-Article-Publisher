"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import DashboardLoading from "@/components/DashboardLoading";
import DashboardShell, { type DashboardNavItem } from "@/components/DashboardShell";
import EmptyState from "@/components/EmptyState";
import PaginationControls from "@/components/PaginationControls";
import StatusToast from "@/components/StatusToast";

type AdminUser = {
  id: string;
  name: string | null;
  email: string | null;
  role: "USER" | "ADMIN";
  emailVerified: string | null;
  tokenBalance: number;
  createdAt: string;
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

const PAGE_SIZE = 6;

export default function AdminPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [packages, setPackages] = useState<AdminPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ type: "success" | "error" | "info"; message: string } | null>(null);
  const [pkgName, setPkgName] = useState("");
  const [pkgSlug, setPkgSlug] = useState("");
  const [pkgDescription, setPkgDescription] = useState("");
  const [pkgFeatures, setPkgFeatures] = useState("");
  const [pkgPriceCents, setPkgPriceCents] = useState(9900);
  const [pkgCurrency, setPkgCurrency] = useState("usd");
  const [pkgTokenAmount, setPkgTokenAmount] = useState(100);
  const [pkgStripePriceId, setPkgStripePriceId] = useState("");
  const [editingPackage, setEditingPackage] = useState<EditablePackageState | null>(null);
  const [updatingPackage, setUpdatingPackage] = useState(false);
  const [deletingPackageId, setDeletingPackageId] = useState<string | null>(null);
  const [adjustUserId, setAdjustUserId] = useState("");
  const [adjustAmount, setAdjustAmount] = useState(0);
  const [adjustNote, setAdjustNote] = useState("");
  const [packageSearch, setPackageSearch] = useState("");
  const [packageFilter, setPackageFilter] = useState("all");
  const [userSearch, setUserSearch] = useState("");
  const [userRoleFilter, setUserRoleFilter] = useState("all");
  const [packagePage, setPackagePage] = useState(1);
  const [userPage, setUserPage] = useState(1);

  const parseFeatureList = (value: string) =>
    value.split(",").map((feature) => feature.trim()).filter(Boolean);

  const loadData = async () => {
    setLoading(true);
    try {
      const [usersRes, packagesRes] = await Promise.all([fetch("/api/admin/users"), fetch("/api/admin/packages")]);
      const usersPayload = await usersRes.json();
      const packagesPayload = await packagesRes.json();
      if (!usersRes.ok) throw new Error(usersPayload?.error || "Failed to load users.");
      if (!packagesRes.ok) throw new Error(packagesPayload?.error || "Failed to load packages.");
      setUsers(usersPayload.users || []);
      setPackages(packagesPayload.packages || []);
    } catch (err) {
      setToast({
        type: "error",
        message: err instanceof Error ? err.message : "Failed to load admin data.",
      });
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
    try {
      const response = await fetch("/api/admin/packages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
      if (!response.ok) throw new Error(payload?.error || "Failed to create package.");
      setToast({ type: "success", message: "Package created successfully." });
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
      setToast({
        type: "error",
        message: err instanceof Error ? err.message : "Failed to create package.",
      });
    }
  };

  const handleAdjustTokens = async (event: FormEvent) => {
    event.preventDefault();
    try {
      const response = await fetch("/api/admin/tokens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: adjustUserId,
          amount: Number(adjustAmount),
          description: adjustNote || undefined,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || "Failed to adjust tokens.");
      setToast({ type: "success", message: "Token balance updated." });
      setAdjustAmount(0);
      setAdjustNote("");
      await loadData();
    } catch (err) {
      setToast({
        type: "error",
        message: err instanceof Error ? err.message : "Failed to adjust tokens.",
      });
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
  };

  const handleUpdatePackage = async (event: FormEvent) => {
    event.preventDefault();
    if (!editingPackage) return;
    try {
      setUpdatingPackage(true);
      const response = await fetch("/api/admin/packages", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
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
      if (!response.ok) throw new Error(payload?.error || "Failed to update package.");
      setToast({ type: "success", message: "Package updated successfully." });
      setEditingPackage(null);
      await loadData();
    } catch (err) {
      setToast({
        type: "error",
        message: err instanceof Error ? err.message : "Failed to update package.",
      });
    } finally {
      setUpdatingPackage(false);
    }
  };

  const handleDeletePackage = async (pkg: AdminPackage) => {
    if (!window.confirm(`Delete package "${pkg.name}"? This action cannot be undone.`)) return;
    try {
      setDeletingPackageId(pkg.id);
      const response = await fetch("/api/admin/packages", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: pkg.id }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || "Failed to delete package.");
      if (editingPackage?.id === pkg.id) setEditingPackage(null);
      setToast({ type: "success", message: payload?.message || "Package deleted." });
      await loadData();
    } catch (err) {
      setToast({
        type: "error",
        message: err instanceof Error ? err.message : "Failed to delete package.",
      });
    } finally {
      setDeletingPackageId(null);
    }
  };

  const filteredPackages = useMemo(
    () =>
      packages.filter((pkg) => {
        const matchesSearch = `${pkg.name} ${pkg.slug} ${pkg.stripePriceId || ""}`
          .toLowerCase()
          .includes(packageSearch.toLowerCase());
        const matchesStatus =
          packageFilter === "all" ||
          (packageFilter === "active" ? pkg.isActive : !pkg.isActive);
        return matchesSearch && matchesStatus;
      }),
    [packageFilter, packageSearch, packages],
  );

  const filteredUsers = useMemo(
    () =>
      users.filter((user) => {
        const matchesSearch = `${user.email || ""} ${user.name || ""}`
          .toLowerCase()
          .includes(userSearch.toLowerCase());
        const matchesRole = userRoleFilter === "all" || user.role === userRoleFilter;
        return matchesSearch && matchesRole;
      }),
    [userRoleFilter, userSearch, users],
  );

  const packageTotalPages = Math.max(1, Math.ceil(filteredPackages.length / PAGE_SIZE));
  const userTotalPages = Math.max(1, Math.ceil(filteredUsers.length / PAGE_SIZE));
  const pagedPackages = filteredPackages.slice((packagePage - 1) * PAGE_SIZE, packagePage * PAGE_SIZE);
  const pagedUsers = filteredUsers.slice((userPage - 1) * PAGE_SIZE, userPage * PAGE_SIZE);

  useEffect(() => {
    setPackagePage((current) => Math.min(current, packageTotalPages));
  }, [packageTotalPages]);

  useEffect(() => {
    setUserPage((current) => Math.min(current, userTotalPages));
  }, [userTotalPages]);

  if (status === "loading" || loading) return <DashboardLoading title="Loading admin panel..." />;

  return (
    <DashboardShell
      title="Admin Dashboard"
      subtitle="Manage packages, users, and token operations with compact admin controls."
      role="ADMIN"
      userLabel={session?.user?.name || session?.user?.email || "Admin"}
      userEmail={session?.user?.email || null}
      tokenBalance={null}
      navItems={
        [
          { href: "/admin", label: "Admin", hint: "Platform administration", group: "Operations", icon: "admin" },
          { href: "/", label: "Workspace", hint: "Content operations", group: "Workspace", icon: "workspace" },
          { href: "/billing", label: "Billing", hint: "Customer packages", group: "Revenue", icon: "billing" },
          { href: "/account", label: "Account", hint: "Profile settings", group: "Settings", icon: "sites" },
        ] satisfies DashboardNavItem[]
      }
    >
      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_420px]">
        <div className="space-y-4">
          <section className="panel px-4 py-4 md:px-5">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="panel-muted px-4 py-4">
                <p className="eyebrow">Users</p>
                <p className="mt-2 text-xl font-semibold text-slate-950">{users.length}</p>
                <p className="mt-1 text-xs text-slate-500">All registered accounts with multi-device access.</p>
              </div>
              <div className="panel-muted px-4 py-4">
                <p className="eyebrow">Packages</p>
                <p className="mt-2 text-xl font-semibold text-slate-950">{packages.length}</p>
                <p className="mt-1 text-xs text-slate-500">Commercial plans powering credit allocation.</p>
              </div>
              <div className="panel-muted px-4 py-4">
                <p className="eyebrow">Active Plans</p>
                <p className="mt-2 text-xl font-semibold text-slate-950">{packages.filter((pkg) => pkg.isActive).length}</p>
                <p className="mt-1 text-xs text-slate-500">Packages currently available for checkout.</p>
              </div>
            </div>
          </section>

          <section className="panel px-4 py-4 md:px-5">
            <div className="section-header">
              <div>
                <p className="eyebrow">Packages</p>
                <h2 className="mt-1 text-sm font-semibold text-slate-950">Catalog management</h2>
              </div>
            </div>

            <div className="mt-4 grid gap-4 xl:grid-cols-2">
              <form className="space-y-4 rounded-2xl border border-slate-200 bg-white px-4 py-4" onSubmit={handleCreatePackage}>
                <div>
                  <p className="text-sm font-semibold text-slate-950">Create package</p>
                  <p className="mt-1 text-xs text-slate-500">Leave Stripe Price ID empty to let the backend create one.</p>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="label">Package name</label>
                    <input className="input" value={pkgName} onChange={(event) => setPkgName(event.target.value)} placeholder="Starter Pack" required />
                  </div>
                  <div>
                    <label className="label">Slug</label>
                    <input className="input" value={pkgSlug} onChange={(event) => setPkgSlug(event.target.value)} placeholder="starter-pack" required />
                  </div>
                  <div className="md:col-span-2">
                    <label className="label">Description</label>
                    <input className="input" value={pkgDescription} onChange={(event) => setPkgDescription(event.target.value)} placeholder="Best for first-time users." />
                  </div>
                  <div className="md:col-span-2">
                    <label className="label">Features</label>
                    <input className="input" value={pkgFeatures} onChange={(event) => setPkgFeatures(event.target.value)} placeholder="Fast generation, priority support" />
                  </div>
                  <div>
                    <label className="label">Price (cents)</label>
                    <input className="input" type="number" value={pkgPriceCents} onChange={(event) => setPkgPriceCents(Number(event.target.value))} required />
                  </div>
                  <div>
                    <label className="label">Currency</label>
                    <input className="input" value={pkgCurrency} onChange={(event) => setPkgCurrency(event.target.value)} required />
                  </div>
                  <div>
                    <label className="label">Token amount</label>
                    <input className="input" type="number" value={pkgTokenAmount} onChange={(event) => setPkgTokenAmount(Number(event.target.value))} required />
                  </div>
                  <div>
                    <label className="label">Stripe price ID</label>
                    <input className="input" value={pkgStripePriceId} onChange={(event) => setPkgStripePriceId(event.target.value)} placeholder="price_..." />
                  </div>
                </div>
                <button className="button-primary" type="submit">Create package</button>
              </form>

              <form className="space-y-4 rounded-2xl border border-slate-200 bg-white px-4 py-4" onSubmit={handleAdjustTokens}>
                <div>
                  <p className="text-sm font-semibold text-slate-950">Adjust user tokens</p>
                  <p className="mt-1 text-xs text-slate-500">Use positive numbers to add credits and negative numbers to deduct them.</p>
                </div>
                <div>
                  <label className="label">User</label>
                  <select className="select" value={adjustUserId} onChange={(event) => setAdjustUserId(event.target.value)} required>
                    <option value="">Select user</option>
                    {users.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.email || user.name || user.id} ({user.tokenBalance})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="label">Amount</label>
                    <input className="input" type="number" value={adjustAmount} onChange={(event) => setAdjustAmount(Number(event.target.value))} placeholder="+50 or -20" required />
                  </div>
                  <div>
                    <label className="label">Note</label>
                    <input className="input" value={adjustNote} onChange={(event) => setAdjustNote(event.target.value)} placeholder="Internal note" />
                  </div>
                </div>
                <button className="button-secondary" type="submit">Apply adjustment</button>
              </form>
            </div>
          </section>

          {editingPackage ? (
            <section className="panel px-4 py-4 md:px-5">
              <div className="section-header">
                <div>
                  <p className="eyebrow">Edit Package</p>
                  <h2 className="mt-1 text-sm font-semibold text-slate-950">{editingPackage.name}</h2>
                </div>
                <button type="button" className="button-muted" onClick={() => setEditingPackage(null)} disabled={updatingPackage}>Cancel</button>
              </div>
              <form className="mt-4 grid gap-4 md:grid-cols-2" onSubmit={handleUpdatePackage}>
                <div>
                  <label className="label">Package name</label>
                  <input className="input" value={editingPackage.name} onChange={(event) => setEditingPackage((current) => current ? { ...current, name: event.target.value } : current)} required />
                </div>
                <div>
                  <label className="label">Slug</label>
                  <input className="input" value={editingPackage.slug} onChange={(event) => setEditingPackage((current) => current ? { ...current, slug: event.target.value } : current)} required />
                </div>
                <div className="md:col-span-2">
                  <label className="label">Description</label>
                  <input className="input" value={editingPackage.description} onChange={(event) => setEditingPackage((current) => current ? { ...current, description: event.target.value } : current)} />
                </div>
                <div className="md:col-span-2">
                  <label className="label">Features</label>
                  <input className="input" value={editingPackage.featureList} onChange={(event) => setEditingPackage((current) => current ? { ...current, featureList: event.target.value } : current)} />
                </div>
                <div>
                  <label className="label">Price (cents)</label>
                  <input className="input" type="number" value={editingPackage.priceCents} onChange={(event) => setEditingPackage((current) => current ? { ...current, priceCents: Number(event.target.value) || 0 } : current)} required />
                </div>
                <div>
                  <label className="label">Currency</label>
                  <input className="input" value={editingPackage.currency} onChange={(event) => setEditingPackage((current) => current ? { ...current, currency: event.target.value } : current)} required />
                </div>
                <div>
                  <label className="label">Token amount</label>
                  <input className="input" type="number" value={editingPackage.tokenAmount} onChange={(event) => setEditingPackage((current) => current ? { ...current, tokenAmount: Number(event.target.value) || 0 } : current)} required />
                </div>
                <div>
                  <label className="label">Stripe price ID</label>
                  <input className="input" value={editingPackage.stripePriceId} onChange={(event) => setEditingPackage((current) => current ? { ...current, stripePriceId: event.target.value } : current)} />
                </div>
                <div className="md:col-span-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                  <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-700">
                    <input type="checkbox" checked={editingPackage.isActive} onChange={(event) => setEditingPackage((current) => current ? { ...current, isActive: event.target.checked } : current)} />
                    Package active
                  </label>
                </div>
                <button className="button-primary md:col-span-2" type="submit" disabled={updatingPackage}>{updatingPackage ? "Saving changes..." : "Save changes"}</button>
              </form>
            </section>
          ) : null}
        </div>

        <div className="space-y-4">
          <section className="panel overflow-hidden">
            <div className="table-toolbar">
              <input className="input md:max-w-xs" value={packageSearch} onChange={(event) => setPackageSearch(event.target.value)} placeholder="Search packages" />
              <select className="select md:max-w-[180px]" value={packageFilter} onChange={(event) => setPackageFilter(event.target.value)}>
                <option value="all">All statuses</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
            {filteredPackages.length === 0 ? (
              <div className="px-4 pb-4 md:px-5">
                <EmptyState title="No packages found" description="Adjust the filters or create a new package to expand the catalog." />
              </div>
            ) : (
              <>
                <div className="table-scroll">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Price</th>
                        <th>Tokens</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pagedPackages.map((pkg) => (
                        <tr key={pkg.id}>
                          <td>
                            <p className="font-medium text-slate-900">{pkg.name}</p>
                            <p className="mt-1 text-xs text-slate-500">{pkg.stripePriceId || pkg.slug}</p>
                          </td>
                          <td>{(pkg.priceCents / 100).toLocaleString(undefined, { style: "currency", currency: pkg.currency.toUpperCase() })}</td>
                          <td>{pkg.tokenAmount}</td>
                          <td><span className={pkg.isActive ? "badge-success" : "badge-neutral"}>{pkg.isActive ? "Active" : "Inactive"}</span></td>
                          <td>
                            <div className="flex flex-wrap gap-2">
                              <button type="button" className="button-muted" onClick={() => startEditingPackage(pkg)} disabled={deletingPackageId === pkg.id}>Edit</button>
                              <button type="button" className="button-danger" onClick={() => void handleDeletePackage(pkg)} disabled={deletingPackageId === pkg.id}>{deletingPackageId === pkg.id ? "Deleting..." : "Delete"}</button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <PaginationControls page={packagePage} totalPages={packageTotalPages} onPageChange={setPackagePage} label="Packages" />
              </>
            )}
          </section>

          <section className="panel overflow-hidden">
            <div className="table-toolbar">
              <input className="input md:max-w-xs" value={userSearch} onChange={(event) => setUserSearch(event.target.value)} placeholder="Search users" />
              <select className="select md:max-w-[180px]" value={userRoleFilter} onChange={(event) => setUserRoleFilter(event.target.value)}>
                <option value="all">All roles</option>
                <option value="ADMIN">Admins</option>
                <option value="USER">Users</option>
              </select>
            </div>
            {filteredUsers.length === 0 ? (
              <div className="px-4 pb-4 md:px-5">
                <EmptyState title="No users found" description="Adjust the filters to review a different segment of the customer base." />
              </div>
            ) : (
              <>
                <div className="table-scroll">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>User</th>
                        <th>Role</th>
                        <th>Tokens</th>
                        <th>Verified</th>
                        <th>WordPress</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pagedUsers.map((user) => (
                        <tr key={user.id}>
                          <td>
                            <p className="font-medium text-slate-900">{user.email || "-"}</p>
                            <p className="mt-1 text-xs text-slate-500">{user.name || "Unnamed user"}</p>
                          </td>
                          <td><span className={user.role === "ADMIN" ? "badge-info" : "badge-neutral"}>{user.role}</span></td>
                          <td>{user.tokenBalance}</td>
                          <td><span className={user.emailVerified ? "badge-success" : "badge-warning"}>{user.emailVerified ? "Verified" : "Pending"}</span></td>
                          <td>{user.wordpressSites[0]?.baseUrl || "-"}{user._count.wordpressSites > 1 ? ` (+${user._count.wordpressSites - 1})` : ""}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <PaginationControls page={userPage} totalPages={userTotalPages} onPageChange={setUserPage} label="Users" />
              </>
            )}
          </section>
        </div>
      </section>

      {toast ? <StatusToast type={toast.type} message={toast.message} onClose={() => setToast(null)} /> : null}
    </DashboardShell>
  );
}
