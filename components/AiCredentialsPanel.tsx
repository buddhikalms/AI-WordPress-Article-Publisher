"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { KeyRound, ShieldCheck, Trash2 } from "lucide-react";

type AiCredentialProvider = "openai" | "gemini";

type AiCredential = {
  provider: AiCredentialProvider;
  label: string;
  hasApiKey: boolean;
  maskedApiKey: string | null;
  defaultModel: string;
  isEnabled: boolean;
  updatedAt: string | null;
  envAvailable: boolean;
};

type AiCredentialForm = Record<
  AiCredentialProvider,
  { apiKey: string; defaultModel: string; isEnabled: boolean }
>;

const modelOptions: Record<AiCredentialProvider, string[]> = {
  openai: ["gpt-4.1-mini", "gpt-4.1", "gpt-4o-mini"],
  gemini: [
    "gemini-3.5-flash",
    "gemini-3.7-flash",
    "gemini-3.6-flash",
    "gemini-3.5-flash-lite",
    "gemini-3.1-flash-lite",
    "gemini-2.5-pro",
    "gemini-2.5-flash",
    "gemini-1.5-flash",
  ],
};

const emptyForm: AiCredentialForm = {
  openai: { apiKey: "", defaultModel: "gpt-4.1-mini", isEnabled: true },
  gemini: { apiKey: "", defaultModel: "gemini-3.5-flash", isEnabled: true },
};

export default function AiCredentialsPanel({
  endpoint,
  title,
  subtitle,
  scopeLabel,
}: {
  endpoint: string;
  title: string;
  subtitle: string;
  scopeLabel: string;
}) {
  const [credentials, setCredentials] = useState<AiCredential[]>([]);
  const [forms, setForms] = useState<AiCredentialForm>(emptyForm);
  const [loading, setLoading] = useState(true);
  const [savingProvider, setSavingProvider] = useState<AiCredentialProvider | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const syncForms = useCallback((items: AiCredential[]) => {
    setForms((current) => {
      const next = { ...current };
      for (const item of items) {
        next[item.provider] = {
          apiKey: "",
          defaultModel: item.defaultModel || current[item.provider].defaultModel,
          isEnabled: item.isEnabled,
        };
      }
      return next;
    });
  }, []);

  const loadCredentials = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(endpoint, { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || "Failed to load AI keys.");
      setCredentials(payload.credentials || []);
      syncForms(payload.credentials || []);
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Failed to load AI keys." });
    } finally {
      setLoading(false);
    }
  }, [endpoint, syncForms]);

  useEffect(() => {
    void loadCredentials();
  }, [loadCredentials]);

  const updateForm = (provider: AiCredentialProvider, patch: Partial<AiCredentialForm[AiCredentialProvider]>) => {
    setForms((current) => ({
      ...current,
      [provider]: { ...current[provider], ...patch },
    }));
  };

  const saveCredential = async (event: FormEvent, provider: AiCredentialProvider) => {
    event.preventDefault();
    setSavingProvider(provider);
    setMessage(null);
    try {
      const form = forms[provider];
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider,
          apiKey: form.apiKey || undefined,
          defaultModel: form.defaultModel,
          isEnabled: form.isEnabled,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || "Failed to save AI key.");
      setCredentials(payload.credentials || []);
      syncForms(payload.credentials || []);
      setMessage({ type: "success", text: payload.message || "AI key saved." });
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Failed to save AI key." });
    } finally {
      setSavingProvider(null);
    }
  };

  const deleteCredential = async (provider: AiCredentialProvider) => {
    setSavingProvider(provider);
    setMessage(null);
    try {
      const response = await fetch(endpoint, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || "Failed to remove AI key.");
      setCredentials(payload.credentials || []);
      syncForms(payload.credentials || []);
      setMessage({ type: "success", text: payload.message || "AI key removed." });
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Failed to remove AI key." });
    } finally {
      setSavingProvider(null);
    }
  };

  return (
    <section id="ai-keys" className="panel px-4 py-4 md:px-5">
      <div className="section-header">
        <div>
          <p className="eyebrow">AI Keys</p>
          <h2 className="mt-1 text-sm font-semibold text-slate-950">{title}</h2>
          <p className="mt-1 max-w-2xl text-xs leading-5 text-slate-500">{subtitle}</p>
        </div>
        <span className="badge-info">{scopeLabel}</span>
      </div>

      {message ? (
        <div className={`mt-4 rounded-lg border px-3 py-2 text-xs ${message.type === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-red-200 bg-red-50 text-red-700"}`}>
          {message.text}
        </div>
      ) : null}

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {(credentials.length ? credentials : [
          { provider: "openai", label: "OpenAI", hasApiKey: false, maskedApiKey: null, defaultModel: "gpt-4.1-mini", isEnabled: false, updatedAt: null, envAvailable: false },
          { provider: "gemini", label: "Gemini", hasApiKey: false, maskedApiKey: null, defaultModel: "gemini-3.5-flash", isEnabled: false, updatedAt: null, envAvailable: false },
        ] as AiCredential[]).map((credential) => {
          const form = forms[credential.provider];
          return (
            <form key={credential.provider} className="panel-muted px-4 py-4" onSubmit={(event) => void saveCredential(event, credential.provider)}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <span className="metric-icon">
                    <KeyRound className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-slate-950">{credential.label}</p>
                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      {credential.hasApiKey ? `Saved key ${credential.maskedApiKey}` : credential.envAvailable ? "Using environment fallback" : "No key saved"}
                    </p>
                  </div>
                </div>
                <span className={credential.hasApiKey || credential.envAvailable ? "badge-success" : "badge-warning"}>
                  {credential.hasApiKey ? "Saved" : credential.envAvailable ? "Env" : "Missing"}
                </span>
              </div>

              <div className="mt-4 space-y-3">
                <div>
                  <label className="label">API key</label>
                  <input
                    className="input"
                    type="password"
                    value={form.apiKey}
                    onChange={(event) => updateForm(credential.provider, { apiKey: event.target.value })}
                    placeholder={credential.hasApiKey ? "Leave empty to keep saved key" : "Paste API key"}
                    autoComplete="off"
                  />
                </div>
                <div>
                  <label className="label">Default model</label>
                  <select
                    className="select"
                    value={form.defaultModel}
                    onChange={(event) => updateForm(credential.provider, { defaultModel: event.target.value })}
                  >
                    {modelOptions[credential.provider].map((model) => (
                      <option key={model} value={model}>{model}</option>
                    ))}
                  </select>
                </div>
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={form.isEnabled}
                    onChange={(event) => updateForm(credential.provider, { isEnabled: event.target.checked })}
                  />
                  Enable this provider for generation
                </label>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <button className="button-primary" type="submit" disabled={savingProvider === credential.provider || loading}>
                  <ShieldCheck className="h-4 w-4" />
                  {savingProvider === credential.provider ? "Saving..." : "Save key"}
                </button>
                {credential.hasApiKey ? (
                  <button
                    className="button-danger"
                    type="button"
                    onClick={() => void deleteCredential(credential.provider)}
                    disabled={savingProvider === credential.provider}
                  >
                    <Trash2 className="h-4 w-4" />
                    Remove
                  </button>
                ) : null}
              </div>
            </form>
          );
        })}
      </div>
    </section>
  );
}