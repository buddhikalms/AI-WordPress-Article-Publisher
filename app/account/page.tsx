"use client";

import { FormEvent, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import DashboardShell, { type DashboardNavItem } from "@/components/DashboardShell";
import type { WordPressSiteSummary } from "@/lib/types";

type AccountPayload = {
  user: {
    name?: string | null;
    email?: string | null;
    role: "USER" | "ADMIN";
    tokenBalance: number;
  };
  wordpressSites: WordPressSiteSummary[];
  defaultWordpressSite: WordPressSiteSummary | null;
};

const emptyForm = {
  siteId: "",
  siteName: "",
  baseUrl: "",
  username: "",
  password: "",
  isDefault: false,
};

export default function AccountPage() {
  const router = useRouter();
  const { status } = useSession();

  const [account, setAccount] = useState<AccountPayload | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [busySiteId, setBusySiteId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadAccount = async () => {
    const response = await fetch("/api/me");
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload?.error || "Failed to load account.");
    }
    setAccount(payload);
  };

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login");
      return;
    }
    if (status !== "authenticated") {
      return;
    }
    void loadAccount().catch((err: unknown) =>
      setError(err instanceof Error ? err.message : "Failed to load account."),
    );
  }, [router, status]);

  const resetForm = () => {
    setForm(emptyForm);
    setEditing(false);
  };

  const startEdit = (site: WordPressSiteSummary) => {
    setEditing(true);
    setForm({
      siteId: site.id,
      siteName: site.name,
      baseUrl: site.baseUrl,
      username: site.username,
      password: "",
      isDefault: site.isDefault,
    });
    setMessage(null);
    setError(null);
  };

  const handleSave = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch("/api/account/wordpress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          siteId: form.siteId || undefined,
          siteName: form.siteName,
          wordpressBaseUrl: form.baseUrl,
          wordpressUsername: form.username,
          wordpressPassword: form.password || undefined,
          isDefault: form.isDefault,
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || "Failed to save site.");
      }
      await loadAccount();
      setMessage(payload?.message || "Site saved.");
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save site.");
    } finally {
      setSaving(false);
    }
  };

  const handleSetDefault = async (siteId: string) => {
    try {
      setBusySiteId(siteId);
      setMessage(null);
      setError(null);
      const response = await fetch("/api/account/wordpress", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ siteId }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || "Failed to update default site.");
      }
      await loadAccount();
      setMessage(payload?.message || "Default site updated.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update default site.");
    } finally {
      setBusySiteId(null);
    }
  };

  const handleDelete = async (site: WordPressSiteSummary) => {
    if (!window.confirm(`Remove "${site.name}"?`)) {
      return;
    }

    try {
      setBusySiteId(site.id);
      setMessage(null);
      setError(null);
      const response = await fetch("/api/account/wordpress", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ siteId: site.id }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || "Failed to remove site.");
      }
      await loadAccount();
      if (form.siteId === site.id) {
        resetForm();
      }
      setMessage(payload?.message || "Site removed.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove site.");
    } finally {
      setBusySiteId(null);
    }
  };

  if (status === "loading" || !account) {
    return <main className="mx-auto max-w-4xl px-4 py-8 text-sm text-slate-600">Loading account...</main>;
  }

  return (
    <DashboardShell
      title="Site Settings"
      subtitle="Manage multiple WordPress sites and keep one default publishing target."
      role={account.user.role}
      userLabel={account.user.name || account.user.email || "User"}
      userEmail={account.user.email || null}
      tokenBalance={account.user.tokenBalance}
      navItems={
        [
          { href: "/", label: "Workspace", hint: "Drafts, imports, and autopilot" },
          { href: "/billing", label: "Billing", hint: "Packages and purchases" },
          { href: "/account", label: "Sites", hint: "Manage connected WordPress sites" },
          { href: "/admin", label: "Admin", hint: "Platform administration", visible: account.user.role === "ADMIN" },
        ] satisfies DashboardNavItem[]
      }
    >
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.05fr)_minmax(340px,0.95fr)]">
        <section className="space-y-5">
          <div className="panel rounded-[1.75rem] p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Profile</p>
            <h2 className="mt-2 text-xl font-semibold text-slate-950">{account.user.name || "-"}</h2>
            <p className="mt-2 text-sm text-slate-600">Email: {account.user.email || "-"}</p>
            <p className="mt-1 text-sm text-slate-600">Role: {account.user.role}</p>
            <p className="mt-1 text-sm text-slate-600">Token balance: {account.user.tokenBalance}</p>
          </div>

          <div className="panel rounded-[1.75rem] p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Connected Sites</p>
                <h2 className="mt-2 text-xl font-semibold text-slate-950">{account.wordpressSites.length} site{account.wordpressSites.length === 1 ? "" : "s"}</h2>
              </div>
              <button type="button" className="button-muted" onClick={resetForm}>Add New Site</button>
            </div>
            <div className="mt-5 grid gap-3">
              {account.wordpressSites.length === 0 ? (
                <div className="rounded-[1.25rem] border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-sm text-slate-600">
                  No sites added yet.
                </div>
              ) : (
                account.wordpressSites.map((site) => (
                  <div key={site.id} className="rounded-[1.35rem] border border-slate-200 bg-white p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-950">{site.name}</p>
                        <p className="mt-1 break-all text-xs text-slate-600">{site.baseUrl}</p>
                        <p className="mt-2 text-xs text-slate-500">Username: {site.username}</p>
                      </div>
                      {site.isDefault ? <span className="rounded-full bg-slate-900 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-white">Default</span> : null}
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button type="button" className="button-muted" onClick={() => startEdit(site)}>Edit</button>
                      {!site.isDefault ? (
                        <button type="button" className="button-secondary" onClick={() => void handleSetDefault(site.id)} disabled={busySiteId === site.id}>
                          {busySiteId === site.id ? "Saving..." : "Set Default"}
                        </button>
                      ) : null}
                      <button type="button" className="button border border-red-300 bg-red-50 text-red-700 hover:bg-red-100" onClick={() => void handleDelete(site)} disabled={busySiteId === site.id}>
                        {busySiteId === site.id ? "Removing..." : "Remove"}
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>

        <section className="space-y-5">
          <div className="panel rounded-[1.75rem] p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{editing ? "Edit Site" : "Add Site"}</p>
            <form className="mt-4 space-y-4" onSubmit={handleSave}>
              <div>
                <label className="label">Site name</label>
                <input className="input" value={form.siteName} onChange={(event) => setForm((current) => ({ ...current, siteName: event.target.value }))} placeholder="Agency blog" required />
              </div>
              <div>
                <label className="label">WordPress base URL</label>
                <input className="input" type="url" value={form.baseUrl} onChange={(event) => setForm((current) => ({ ...current, baseUrl: event.target.value }))} placeholder="https://example.com" required />
              </div>
              <div>
                <label className="label">WordPress username</label>
                <input className="input" value={form.username} onChange={(event) => setForm((current) => ({ ...current, username: event.target.value }))} placeholder="wp-user" required />
              </div>
              <div>
                <label className="label">WordPress app password</label>
                <input className="input" type="password" value={form.password} onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))} placeholder={editing ? "Leave empty to keep current password" : "Enter app password"} required={!editing} />
              </div>
              <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-700">
                <input type="checkbox" checked={form.isDefault} onChange={(event) => setForm((current) => ({ ...current, isDefault: event.target.checked }))} />
                Make this the default publishing site
              </label>
              <div className="flex flex-wrap gap-3">
                <button className="button-primary" type="submit" disabled={saving}>{saving ? "Saving..." : editing ? "Save Site" : "Add Site"}</button>
                {editing ? <button className="button-muted" type="button" onClick={resetForm}>Cancel</button> : null}
              </div>
            </form>
          </div>

          <div className="panel rounded-[1.75rem] p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Google Doc Access</p>
            <p className="mt-3 text-sm text-slate-700">
              Google Doc publishing now works from the document link only. For private docs, change sharing to
              {" "}Anyone with the link can view or use File &gt; Share &gt; Publish to web. No Google service email or private key is required.
            </p>
          </div>

          {message ? <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">{message}</div> : null}
          {error ? <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">{error}</div> : null}
        </section>
      </div>
    </DashboardShell>
  );
}
