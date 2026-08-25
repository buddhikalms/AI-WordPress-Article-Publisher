"use client";

import { FormEvent, useEffect, useState } from "react";
import { signOut, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import AiCredentialsPanel from "@/components/AiCredentialsPanel";
import DashboardLoadError from "@/components/DashboardLoadError";
import DashboardLoading from "@/components/DashboardLoading";
import DashboardShell, { type DashboardNavItem } from "@/components/DashboardShell";
import EmptyState from "@/components/EmptyState";
import StatusToast from "@/components/StatusToast";
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

const emptyPasswordForm = {
  currentPassword: "",
  newPassword: "",
  confirmPassword: "",
};

export default function AccountPage() {
  const router = useRouter();
  const { status } = useSession();
  const [account, setAccount] = useState<AccountPayload | null>(null);
  const [accountLoadError, setAccountLoadError] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [profileName, setProfileName] = useState("");
  const [passwordForm, setPasswordForm] = useState(emptyPasswordForm);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [busySiteId, setBusySiteId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: "success" | "error" | "info"; message: string } | null>(null);

  const loadAccount = async () => {
    setAccountLoadError(null);
    const response = await fetch("/api/me");
    const payload = await response.json();
    if (!response.ok) throw new Error(payload?.error || "Failed to load account.");
    setAccount(payload);
    setProfileName(payload.user?.name || "");
  };

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login");
      return;
    }
    if (status !== "authenticated") return;
    void loadAccount().catch((err: unknown) => {
      const message = err instanceof Error ? err.message : "Failed to load account.";
      setAccountLoadError(message);
      setToast({
        type: "error",
        message,
      });
    });
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
  };

  const handleSave = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
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
      if (!response.ok) throw new Error(payload?.error || "Failed to save site.");
      await loadAccount();
      setToast({ type: "success", message: payload?.message || "Site saved." });
      resetForm();
    } catch (err) {
      setToast({
        type: "error",
        message: err instanceof Error ? err.message : "Failed to save site.",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleProfileSave = async (event: FormEvent) => {
    event.preventDefault();
    setSavingProfile(true);
    try {
      const response = await fetch("/api/account/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: profileName }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || "Failed to update profile.");
      await loadAccount();
      setToast({ type: "success", message: payload?.message || "Profile updated." });
    } catch (err) {
      setToast({
        type: "error",
        message: err instanceof Error ? err.message : "Failed to update profile.",
      });
    } finally {
      setSavingProfile(false);
    }
  };

  const handlePasswordSave = async (event: FormEvent) => {
    event.preventDefault();
    setSavingPassword(true);
    try {
      const response = await fetch("/api/account/password", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(passwordForm),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || "Failed to change password.");
      setPasswordForm(emptyPasswordForm);
      setToast({ type: "success", message: payload?.message || "Password changed." });
    } catch (err) {
      setToast({
        type: "error",
        message: err instanceof Error ? err.message : "Failed to change password.",
      });
    } finally {
      setSavingPassword(false);
    }
  };

  const handleSetDefault = async (siteId: string) => {
    try {
      setBusySiteId(siteId);
      const response = await fetch("/api/account/wordpress", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ siteId }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || "Failed to update default site.");
      await loadAccount();
      setToast({ type: "success", message: payload?.message || "Default site updated." });
    } catch (err) {
      setToast({
        type: "error",
        message: err instanceof Error ? err.message : "Failed to update default site.",
      });
    } finally {
      setBusySiteId(null);
    }
  };

  const handleDelete = async (site: WordPressSiteSummary) => {
    if (!window.confirm(`Remove "${site.name}"?`)) return;
    try {
      setBusySiteId(site.id);
      const response = await fetch("/api/account/wordpress", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ siteId: site.id }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || "Failed to remove site.");
      await loadAccount();
      if (form.siteId === site.id) resetForm();
      setToast({ type: "success", message: payload?.message || "Site removed." });
    } catch (err) {
      setToast({
        type: "error",
        message: err instanceof Error ? err.message : "Failed to remove site.",
      });
    } finally {
      setBusySiteId(null);
    }
  };

  if (status === "loading") return <DashboardLoading title="Loading site settings..." />;
  if (!account && accountLoadError) {
    return (
      <DashboardLoadError
        title="Unable to open site settings"
        message={accountLoadError}
        onRetry={() => void loadAccount().catch((err: unknown) => {
          const message = err instanceof Error ? err.message : "Failed to load account.";
          setAccountLoadError(message);
        })}
        onSignOut={() => void signOut({ callbackUrl: "/login" })}
      />
    );
  }
  if (!account) return <DashboardLoading title="Loading site settings..." />;

  return (
    <DashboardShell
      title="Account Settings"
      subtitle="Manage your profile, password, and connected WordPress publishing destinations."
      role={account.user.role}
      userLabel={account.user.name || account.user.email || "User"}
      userEmail={account.user.email || null}
      tokenBalance={account.user.tokenBalance}
      navItems={
        [
          { href: "/app/dashboard", label: "Workspace", hint: "Drafts, imports, and autopilot", group: "Workspace", icon: "workspace" },
          { href: "/billing", label: "Billing", hint: "Packages and purchases", group: "Revenue", icon: "billing" },
          { href: "/account", label: "Account", hint: "Profile, password, sites, and AI keys", group: "Settings", icon: "sites" },
          { href: "/account#ai-keys", label: "AI Keys", hint: "OpenAI and Gemini credentials", group: "Settings", icon: "settings" },
          { href: "/admin", label: "Admin", hint: "Platform administration", visible: account.user.role === "ADMIN", group: "Operations", icon: "admin" },
        ] satisfies DashboardNavItem[]
      }
    >
      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_380px]">
        <div className="space-y-4">
          <section className="panel px-4 py-4 md:px-5">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="panel-muted px-4 py-4">
                <p className="eyebrow">Profile</p>
                <p className="mt-2 text-sm font-semibold text-slate-950">{account.user.name || "-"}</p>
                <p className="mt-1 text-xs text-slate-500">{account.user.email || "-"}</p>
              </div>
              <div className="panel-muted px-4 py-4">
                <p className="eyebrow">Role</p>
                <p className="mt-2 text-sm font-semibold text-slate-950">{account.user.role}</p>
                <p className="mt-1 text-xs text-slate-500">Permissions follow your current subscription workspace.</p>
              </div>
              <div className="panel-muted px-4 py-4">
                <p className="eyebrow">Connected Sites</p>
                <p className="mt-2 text-sm font-semibold text-slate-950">{account.wordpressSites.length}</p>
                <p className="mt-1 text-xs text-slate-500">One site can remain the default publishing destination.</p>
              </div>
            </div>
          </section>
          <AiCredentialsPanel
            endpoint="/api/account/ai-credentials"
            title="Your AI provider keys"
            subtitle="Save personal OpenAI or Gemini keys for generation. Your key is encrypted and used before any platform fallback key."
            scopeLabel="User"
          />



          <section className="panel px-4 py-4 md:px-5">
            <div className="section-header">
              <div>
                <p className="eyebrow">Profile Settings</p>
                <h2 className="mt-1 text-sm font-semibold text-slate-950">Personal details</h2>
              </div>
            </div>

            <form className="mt-4 grid gap-4 md:grid-cols-[minmax(0,1fr)_220px]" onSubmit={handleProfileSave}>
              <div className="panel-muted px-4 py-4">
                <label className="label">Display name</label>
                <input
                  className="input"
                  value={profileName}
                  onChange={(event) => setProfileName(event.target.value)}
                  placeholder="Your name"
                  required
                />
              </div>
              <div className="panel-muted px-4 py-4">
                <label className="label">Email address</label>
                <input className="input" value={account.user.email || ""} disabled />
                <p className="helper">Email changes are not enabled yet.</p>
              </div>
              <div className="md:col-span-2">
                <button className="button-primary" type="submit" disabled={savingProfile}>
                  {savingProfile ? "Saving..." : "Save profile"}
                </button>
              </div>
            </form>
          </section>

          <section className="panel px-4 py-4 md:px-5">
            <div className="section-header">
              <div>
                <p className="eyebrow">Security</p>
                <h2 className="mt-1 text-sm font-semibold text-slate-950">Change password</h2>
              </div>
            </div>

            <form className="mt-4 grid gap-4 md:grid-cols-3" onSubmit={handlePasswordSave}>
              <div className="panel-muted px-4 py-4">
                <label className="label">Current password</label>
                <input
                  className="input"
                  type="password"
                  value={passwordForm.currentPassword}
                  onChange={(event) => setPasswordForm((current) => ({ ...current, currentPassword: event.target.value }))}
                  required
                />
              </div>
              <div className="panel-muted px-4 py-4">
                <label className="label">New password</label>
                <input
                  className="input"
                  type="password"
                  value={passwordForm.newPassword}
                  onChange={(event) => setPasswordForm((current) => ({ ...current, newPassword: event.target.value }))}
                  minLength={8}
                  required
                />
              </div>
              <div className="panel-muted px-4 py-4">
                <label className="label">Confirm password</label>
                <input
                  className="input"
                  type="password"
                  value={passwordForm.confirmPassword}
                  onChange={(event) => setPasswordForm((current) => ({ ...current, confirmPassword: event.target.value }))}
                  minLength={8}
                  required
                />
              </div>
              <div className="md:col-span-3">
                <button className="button-primary" type="submit" disabled={savingPassword}>
                  {savingPassword ? "Changing..." : "Change password"}
                </button>
              </div>
            </form>
          </section>

          <section className="panel px-4 py-4 md:px-5">
            <div className="section-header">
              <div>
                <p className="eyebrow">Connected Sites</p>
                <h2 className="mt-1 text-sm font-semibold text-slate-950">WordPress destinations</h2>
              </div>
              <button type="button" className="button-muted" onClick={resetForm}>Add new site</button>
            </div>

            <div className="mt-4 grid gap-3">
              {account.wordpressSites.length === 0 ? (
                <EmptyState
                  title="No sites added yet"
                  description="Add the first WordPress site to enable the publishing workspace and taxonomy sync."
                />
              ) : (
                account.wordpressSites.map((site) => (
                  <div key={site.id} className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-950">{site.name}</p>
                        <p className="mt-1 break-all text-xs text-slate-500">{site.baseUrl}</p>
                        <p className="mt-2 text-xs text-slate-500">Username: {site.username}</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {site.isDefault ? <span className="badge-info">Default</span> : <span className="badge-neutral">Secondary</span>}
                        <span className="badge-neutral">{new Date(site.updatedAt).toLocaleDateString()}</span>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <button type="button" className="button-muted" onClick={() => startEdit(site)}>Edit</button>
                      {!site.isDefault ? (
                        <button type="button" className="button-secondary" onClick={() => void handleSetDefault(site.id)} disabled={busySiteId === site.id}>
                          {busySiteId === site.id ? "Saving..." : "Set default"}
                        </button>
                      ) : null}
                      <button type="button" className="button-danger" onClick={() => void handleDelete(site)} disabled={busySiteId === site.id}>
                        {busySiteId === site.id ? "Removing..." : "Remove"}
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>

        <div className="space-y-4">
          <section className="panel px-4 py-4 md:px-5">
            <div className="section-header">
              <div>
                <p className="eyebrow">{editing ? "Edit Site" : "Add Site"}</p>
                <h2 className="mt-1 text-sm font-semibold text-slate-950">{editing ? "Update WordPress connection" : "Create a new WordPress connection"}</h2>
              </div>
            </div>

            <form className="mt-4 space-y-4" onSubmit={handleSave}>
              <div className="panel-muted px-4 py-4">
                <label className="label">Site name</label>
                <input className="input" value={form.siteName} onChange={(event) => setForm((current) => ({ ...current, siteName: event.target.value }))} placeholder="Agency blog" required />
                <p className="helper">Internal label used across the dashboard and publish workflow.</p>
              </div>

              <div className="panel-muted px-4 py-4">
                <label className="label">WordPress base URL</label>
                <input className="input" type="url" value={form.baseUrl} onChange={(event) => setForm((current) => ({ ...current, baseUrl: event.target.value }))} placeholder="https://example.com" required />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="panel-muted px-4 py-4">
                  <label className="label">WordPress username</label>
                  <input className="input" value={form.username} onChange={(event) => setForm((current) => ({ ...current, username: event.target.value }))} placeholder="wp-user" required />
                </div>
                <div className="panel-muted px-4 py-4">
                  <label className="label">App password</label>
                  <input className="input" type="password" value={form.password} onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))} placeholder={editing ? "Leave empty to keep current password" : "Enter app password"} required={!editing} />
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-700">
                  <input type="checkbox" checked={form.isDefault} onChange={(event) => setForm((current) => ({ ...current, isDefault: event.target.checked }))} />
                  Make this the default publishing site
                </label>
                <p className="helper">The workspace uses the default site as the initial publishing target.</p>
              </div>

              <div className="flex flex-wrap gap-2">
                <button className="button-primary" type="submit" disabled={saving}>{saving ? "Saving..." : editing ? "Save site" : "Add site"}</button>
                {editing ? <button className="button-muted" type="button" onClick={resetForm}>Cancel</button> : null}
              </div>
            </form>
          </section>

          <section className="panel px-4 py-4 md:px-5">
            <p className="eyebrow">Google Doc Access</p>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Google Doc publishing works from the document link only. For private docs, set sharing to Anyone with the link can view or use Publish to web.
            </p>
          </section>
        </div>
      </section>

      {toast ? <StatusToast type={toast.type} message={toast.message} onClose={() => setToast(null)} /> : null}
    </DashboardShell>
  );
}
