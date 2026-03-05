"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import ArticlePreview from "@/components/ArticlePreview";
import DashboardShell, { type DashboardNavItem } from "@/components/DashboardShell";
import LinkTable from "@/components/LinkTable";
import SeoFields from "@/components/SeoFields";
import StatusToast from "@/components/StatusToast";
import { slugifyArticle } from "@/lib/slug";
import type {
  HyperlinkInput,
  SEOProvider,
  SeoPayload,
  WordPressSiteSummary,
} from "@/lib/types";

type ToastState = { type: "success" | "error" | "info"; message: string };
type PublishMode = "draft" | "publish" | "future";
type WorkspaceMode = "manual" | "google-doc" | "news";
type CategoryOption = { id: number; name: string; slug: string; count?: number };
type GeneratedImageState = {
  imageBase64: string;
  mimeType: string;
  filenameSuggestion: string;
  altTextSuggestion: string;
  tokenCharge?: { amount: number; remaining: number };
};
type PublishResultState = {
  postId: number;
  link: string;
  status: string;
  seoUpdate?: { ok?: boolean };
  tokenCharge?: { remaining: number };
};
type GoogleDocPublishResultState = {
  title: string;
  link: string;
  tokenCharge?: { remaining: number };
};
type NewsAutoPublishResultState = {
  published: number;
  failed: number;
  tokenCharge?: { remaining: number };
};
type AccountSummaryState = {
  tokenBalance: number;
  role: "USER" | "ADMIN";
  emailVerified: string | null;
  name?: string | null;
  wordpressSites: WordPressSiteSummary[];
  defaultWordpressSite: WordPressSiteSummary | null;
};

const toneOptions = ["Professional", "Conversational", "Authoritative", "Friendly", "Technical"];
const newsCategoryOptions = [
  "business",
  "entertainment",
  "environment",
  "food",
  "health",
  "politics",
  "science",
  "sports",
  "technology",
  "top",
  "tourism",
  "world",
] as const;

const initialSeoPayload: SeoPayload = {
  seoTitle: "",
  metaDescription: "",
  focusKeyword: "",
  canonicalUrl: "",
  og: { title: "", description: "", imageUrl: "" },
  twitter: { title: "", description: "", imageUrl: "" },
};

const initialLink: HyperlinkInput = {
  url: "",
  anchorText: "",
  required: false,
  followType: "dofollow",
};

const workspaceTabs = [
  ["manual", "Manual Studio", "Generate, review, and publish from a brief."],
  ["google-doc", "Google Doc Import", "Publish from a single Google Doc link."],
  ["news", "News Autopilot", "Rewrite and publish category news."],
] as const;

const parseKeywords = (keywords: string) =>
  keywords.split(",").map((item) => item.trim()).filter(Boolean);

const toIsoFromLocalDateTime = (value: string) => {
  if (!value.trim()) {
    return undefined;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error("Invalid date/time selected.");
  }
  return parsed.toISOString();
};

const normalizeLinks = (links: HyperlinkInput[]) => {
  const rows = links.filter((link) => link.url.trim() || link.anchorText.trim());
  for (const row of rows) {
    if (!row.url.trim() || !row.anchorText.trim()) {
      throw new Error("Each hyperlink row must include both URL and anchor text.");
    }
  }
  return rows.map((row) => ({
    url: row.url.trim(),
    anchorText: row.anchorText.trim(),
    required: row.required,
    followType: row.followType || "dofollow",
  }));
};

const getApiError = async (response: Response) => {
  try {
    const body = (await response.json()) as { error?: string };
    return body.error || `Request failed with ${response.status}`;
  } catch {
    return `Request failed with ${response.status}`;
  }
};

export default function HomePage() {
  const router = useRouter();
  const { data: session, status } = useSession();

  const [workspaceMode, setWorkspaceMode] = useState<WorkspaceMode>("manual");
  const [account, setAccount] = useState<AccountSummaryState | null>(null);
  const [selectedSiteId, setSelectedSiteId] = useState("");
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<number[]>([]);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [seoProvider, setSeoProvider] = useState<SEOProvider>("None");
  const [seoPayload, setSeoPayload] = useState<SeoPayload>(initialSeoPayload);
  const [toast, setToast] = useState<ToastState | null>(null);

  const [title, setTitle] = useState("");
  const [brief, setBrief] = useState("");
  const [keywords, setKeywords] = useState("");
  const [tone, setTone] = useState("Professional");
  const [wordCount, setWordCount] = useState(1200);
  const [links, setLinks] = useState<HyperlinkInput[]>([initialLink]);
  const [inPostImageCount, setInPostImageCount] = useState(0);
  const [generatedHtml, setGeneratedHtml] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [suggestedTags, setSuggestedTags] = useState<string[]>([]);
  const [generatedImage, setGeneratedImage] = useState<GeneratedImageState | null>(null);
  const [publishMode, setPublishMode] = useState<PublishMode>("draft");
  const [scheduledAtLocal, setScheduledAtLocal] = useState("");

  const [googleDocInput, setGoogleDocInput] = useState("");
  const [googleDocPublishMode, setGoogleDocPublishMode] = useState<PublishMode>("draft");
  const [googleDocScheduledAtLocal, setGoogleDocScheduledAtLocal] = useState("");

  const [newsCategory, setNewsCategory] =
    useState<(typeof newsCategoryOptions)[number]>("technology");
  const [newsQuery, setNewsQuery] = useState("");
  const [newsLanguage, setNewsLanguage] = useState("en");
  const [newsMaxArticles, setNewsMaxArticles] = useState(1);
  const [newsPublishMode, setNewsPublishMode] = useState<PublishMode>("publish");
  const [newsScheduledAtLocal, setNewsScheduledAtLocal] = useState("");

  const [publishResult, setPublishResult] = useState<PublishResultState | null>(null);
  const [googleDocPublishResult, setGoogleDocPublishResult] =
    useState<GoogleDocPublishResultState | null>(null);
  const [newsAutoPublishResult, setNewsAutoPublishResult] =
    useState<NewsAutoPublishResultState | null>(null);

  const [isGeneratingDraft, setIsGeneratingDraft] = useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isPublishingGoogleDoc, setIsPublishingGoogleDoc] = useState(false);
  const [isAutoPublishingNews, setIsAutoPublishingNews] = useState(false);
  const [isLoadingCategories, setIsLoadingCategories] = useState(false);

  const selectedSite =
    account?.wordpressSites.find((site) => site.id === selectedSiteId) ?? null;
  const hasSiteConfigured = (account?.wordpressSites.length || 0) > 0;
  const isBusy =
    isGeneratingDraft || isGeneratingImage || isPublishing || isPublishingGoogleDoc || isAutoPublishingNews;

  const keywordsCount = parseKeywords(keywords).length;
  const currentSlug = slugifyArticle(title);

  const loadAccount = async () => {
    const response = await fetch("/api/me");
    if (!response.ok) {
      throw new Error(await getApiError(response));
    }

    const data = (await response.json()) as {
      user: {
        tokenBalance: number;
        role: "USER" | "ADMIN";
        emailVerified: string | null;
        name?: string | null;
      };
      wordpressSites: WordPressSiteSummary[];
      defaultWordpressSite: WordPressSiteSummary | null;
    };

    setAccount({
      tokenBalance: data.user.tokenBalance,
      role: data.user.role,
      emailVerified: data.user.emailVerified,
      name: data.user.name,
      wordpressSites: data.wordpressSites || [],
      defaultWordpressSite: data.defaultWordpressSite || null,
    });

    setSelectedSiteId((current) =>
      current && (data.wordpressSites || []).some((site) => site.id === current)
        ? current
        : data.defaultWordpressSite?.id || data.wordpressSites?.[0]?.id || "",
    );
  };

  const loadCategories = async (siteId: string, showToastOnError = false) => {
    try {
      setIsLoadingCategories(true);
      const response = await fetch(`/api/wp-categories?siteId=${encodeURIComponent(siteId)}`);
      if (!response.ok) {
        throw new Error(await getApiError(response));
      }
      const data = (await response.json()) as { categories: CategoryOption[] };
      const nextCategories = data.categories || [];
      setCategories(nextCategories);
      setSelectedCategoryIds((current) =>
        current.filter((id) => nextCategories.some((category) => category.id === id)),
      );
    } catch (error) {
      if (showToastOnError) {
        setToast({
          type: "error",
          message:
            error instanceof Error ? error.message : "Failed to load WordPress categories.",
        });
      }
    } finally {
      setIsLoadingCategories(false);
    }
  };

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login");
      return;
    }
    if (status !== "authenticated") {
      return;
    }
    void loadAccount().catch((error: unknown) => {
      setToast({
        type: "error",
        message:
          error instanceof Error ? error.message : "Failed to load account details.",
      });
    });
  }, [router, status]);

  useEffect(() => {
    if (!selectedSiteId) {
      setCategories([]);
      setSelectedCategoryIds([]);
      return;
    }
    setSelectedCategoryIds([]);
    void loadCategories(selectedSiteId, false);
  }, [selectedSiteId]);

  const syncBalance = (remaining?: number) => {
    if (typeof remaining !== "number") {
      return;
    }
    setAccount((current) =>
      current ? { ...current, tokenBalance: remaining } : current,
    );
  };

  const handleGenerateDraft = async () => {
    try {
      if (!title.trim() || !brief.trim()) {
        throw new Error("Title and topic brief are required.");
      }
      if (!seoPayload.focusKeyword.trim()) {
        throw new Error("Focus keyword is required before draft generation.");
      }
      setIsGeneratingDraft(true);
      setPublishResult(null);
      setGoogleDocPublishResult(null);
      setNewsAutoPublishResult(null);

      const response = await fetch("/api/generate-article", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          brief: brief.trim(),
          keywords: parseKeywords(keywords),
          focusKeyword: seoPayload.focusKeyword.trim(),
          tone,
          wordCount: Number(wordCount),
          links: normalizeLinks(links),
        }),
      });

      if (!response.ok) {
        throw new Error(await getApiError(response));
      }

      const data = (await response.json()) as {
        html: string;
        meta: { excerpt: string; suggestedTags: string[]; seo: SeoPayload };
        tokenCharge?: { amount: number; remaining: number };
      };

      setGeneratedHtml(data.html);
      setExcerpt(data.meta.excerpt);
      setSuggestedTags(data.meta.suggestedTags || []);
      setSeoPayload((current) => ({
        ...current,
        ...data.meta.seo,
        focusKeyword: data.meta.seo.focusKeyword || current.focusKeyword,
        canonicalUrl: current.canonicalUrl || data.meta.seo.canonicalUrl || "",
        og: { ...current.og, ...data.meta.seo.og },
        twitter: { ...current.twitter, ...data.meta.seo.twitter },
      }));
      syncBalance(data.tokenCharge?.remaining);
      setToast({
        type: "success",
        message: data.tokenCharge
          ? `Draft generated. ${data.tokenCharge.amount} tokens used.`
          : "Draft HTML generated successfully.",
      });
    } catch (error) {
      setToast({
        type: "error",
        message: error instanceof Error ? error.message : "Failed to generate draft.",
      });
    } finally {
      setIsGeneratingDraft(false);
    }
  };

  const handleGenerateImage = async () => {
    try {
      if (!title.trim() || !brief.trim()) {
        throw new Error("Title and topic brief are required before image generation.");
      }
      setIsGeneratingImage(true);
      const response = await fetch("/api/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), brief: brief.trim() }),
      });
      if (!response.ok) {
        throw new Error(await getApiError(response));
      }
      const data = (await response.json()) as GeneratedImageState;
      setGeneratedImage(data);
      syncBalance(data.tokenCharge?.remaining);
      setToast({
        type: "success",
        message: data.tokenCharge
          ? `Image generated. ${data.tokenCharge.amount} tokens used.`
          : "Featured image generated successfully.",
      });
    } catch (error) {
      setToast({
        type: "error",
        message: error instanceof Error ? error.message : "Failed to generate image.",
      });
    } finally {
      setIsGeneratingImage(false);
    }
  };

  const handlePublishPost = async () => {
    try {
      if (!selectedSiteId) {
        throw new Error("Select a WordPress site before publishing.");
      }
      if (!generatedHtml.trim()) {
        throw new Error("Generate a draft before publishing.");
      }
      if (!excerpt.trim()) {
        throw new Error("Excerpt is required before publishing.");
      }
      if (publishMode === "future" && !scheduledAtLocal.trim()) {
        throw new Error("Select a future schedule date/time first.");
      }

      setIsPublishing(true);
      const response = await fetch("/api/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          siteId: selectedSiteId,
          title: title.trim(),
          brief: brief.trim(),
          html: generatedHtml,
          excerpt: excerpt.trim(),
          status: publishMode,
          scheduledAt: publishMode === "future" ? toIsoFromLocalDateTime(scheduledAtLocal) : undefined,
          featuredImageBase64: generatedImage?.imageBase64,
          featuredImageMime: generatedImage?.mimeType,
          inPostImageCount,
          selectedCategoryIds,
          newCategoryName: newCategoryName.trim(),
          seoProvider,
          seoPayload,
        }),
      });
      if (!response.ok) {
        throw new Error(await getApiError(response));
      }
      const data = (await response.json()) as PublishResultState;
      setPublishResult(data);
      syncBalance(data.tokenCharge?.remaining);
      if (newCategoryName.trim()) {
        setNewCategoryName("");
        void loadCategories(selectedSiteId, false);
      }
      setToast({ type: data.seoUpdate?.ok ? "success" : "info", message: `Post #${data.postId} saved.` });
    } catch (error) {
      setToast({
        type: "error",
        message: error instanceof Error ? error.message : "Failed to publish post.",
      });
    } finally {
      setIsPublishing(false);
    }
  };

  const handlePublishGoogleDoc = async () => {
    try {
      if (!selectedSiteId) {
        throw new Error("Select a WordPress site before importing a Google Doc.");
      }
      if (!googleDocInput.trim()) {
        throw new Error("Google Doc URL or ID is required.");
      }
      if (googleDocPublishMode === "future" && !googleDocScheduledAtLocal.trim()) {
        throw new Error("Select a future schedule date/time first.");
      }

      setIsPublishingGoogleDoc(true);
      const response = await fetch("/api/google-doc-publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          siteId: selectedSiteId,
          document: googleDocInput.trim(),
          status: googleDocPublishMode,
          scheduledAt:
            googleDocPublishMode === "future"
              ? toIsoFromLocalDateTime(googleDocScheduledAtLocal)
              : undefined,
          selectedCategoryIds,
          newCategoryName: newCategoryName.trim(),
          seoProvider,
        }),
      });
      if (!response.ok) {
        throw new Error(await getApiError(response));
      }
      const data = (await response.json()) as GoogleDocPublishResultState;
      setGoogleDocPublishResult(data);
      syncBalance(data.tokenCharge?.remaining);
      if (newCategoryName.trim()) {
        setNewCategoryName("");
        void loadCategories(selectedSiteId, false);
      }
      setToast({ type: "success", message: `Google Doc "${data.title}" published.` });
    } catch (error) {
      setToast({
        type: "error",
        message:
          error instanceof Error ? error.message : "Failed to publish post from Google Doc.",
      });
    } finally {
      setIsPublishingGoogleDoc(false);
    }
  };

  const handleAutoPublishNews = async () => {
    try {
      if (!selectedSiteId) {
        throw new Error("Select a WordPress site before running news autopilot.");
      }
      if (newsPublishMode === "future" && !newsScheduledAtLocal.trim()) {
        throw new Error("Select a future schedule date/time first.");
      }

      setIsAutoPublishingNews(true);
      const response = await fetch("/api/news-autopublish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          siteId: selectedSiteId,
          category: newsCategory,
          query: newsQuery.trim(),
          language: newsLanguage.trim(),
          maxArticles: newsMaxArticles,
          tone,
          wordCount,
          status: newsPublishMode,
          scheduledAt:
            newsPublishMode === "future" ? toIsoFromLocalDateTime(newsScheduledAtLocal) : undefined,
          selectedCategoryIds,
          newCategoryName: newCategoryName.trim(),
          inPostImageCount,
          seoProvider,
        }),
      });
      if (!response.ok) {
        throw new Error(await getApiError(response));
      }
      const data = (await response.json()) as NewsAutoPublishResultState;
      setNewsAutoPublishResult(data);
      syncBalance(data.tokenCharge?.remaining);
      setToast({
        type: data.failed > 0 ? "info" : "success",
        message:
          data.failed > 0
            ? `${data.published} article(s) published, ${data.failed} failed.`
            : `${data.published} article(s) published successfully.`,
      });
    } catch (error) {
      setToast({
        type: "error",
        message: error instanceof Error ? error.message : "Failed to auto-publish news.",
      });
    } finally {
      setIsAutoPublishingNews(false);
    }
  };

  if (status === "loading" || !account) {
    return <main className="mx-auto max-w-4xl px-4 py-10 text-sm text-slate-600">Loading workspace...</main>;
  }

  if (status === "unauthenticated") {
    return null;
  }

  return (
    <DashboardShell
      title="Publishing Workspace"
      subtitle="Choose a site, then run the workflow that fits the job."
      role={account.role}
      userLabel={account.name || session?.user?.email || "User"}
      userEmail={session?.user?.email || null}
      tokenBalance={account.tokenBalance}
      navItems={
        [
          { href: "/", label: "Workspace", hint: "Drafts, imports, and autopilot" },
          { href: "/billing", label: "Billing", hint: "Packages and token usage" },
          { href: "/account", label: "Sites", hint: "Manage connected WordPress sites" },
          { href: "/admin", label: "Admin", hint: "Users and packages", visible: account.role === "ADMIN" },
        ] satisfies DashboardNavItem[]
      }
    >
      {!hasSiteConfigured ? (
        <div className="rounded-[1.5rem] border border-amber-300 bg-gradient-to-r from-amber-50 to-white px-5 py-4 text-sm text-amber-950 shadow-sm">
          No WordPress site is connected yet. Add one in{" "}
          <Link href="/account" className="font-semibold underline">
            Site Settings
          </Link>{" "}
          before you publish.
        </div>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(340px,0.9fr)]">
        <section className="space-y-5">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
            <div className="rounded-[1.75rem] border border-slate-200 bg-[linear-gradient(135deg,#0f172a_0%,#1d4ed8_55%,#93c5fd_100%)] p-6 text-white shadow-xl">
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-blue-100">Active Workspace</p>
              <h2 className="mt-3 text-2xl font-semibold">
                {selectedSite ? selectedSite.name : "Connect a WordPress site"}
              </h2>
              <p className="mt-2 text-sm text-blue-50">
                {selectedSite
                  ? `${selectedSite.baseUrl} connected as ${selectedSite.username}.`
                  : "Registration no longer forces a site. Connect one or more sites when you are ready to publish."}
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold">
                  {account.tokenBalance.toLocaleString()} tokens
                </span>
                <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold">
                  {account.wordpressSites.length} site{account.wordpressSites.length === 1 ? "" : "s"}
                </span>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
              <div className="panel rounded-[1.5rem] p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Slug Preview</p>
                <p className="mt-3 text-3xl font-semibold text-slate-950">
                  {title.trim() ? currentSlug || "article" : "--"}
                </p>
                <p className="mt-2 text-sm text-slate-600">
                  {keywordsCount} keyword{keywordsCount === 1 ? "" : "s"} parsed
                </p>
              </div>
              <div className="panel rounded-[1.5rem] p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Categories</p>
                <p className="mt-3 text-3xl font-semibold text-slate-950">{selectedCategoryIds.length}</p>
                <p className="mt-2 text-sm text-slate-600">
                  {isLoadingCategories
                    ? "Loading selected site categories..."
                    : selectedSite
                      ? `${categories.length} available on this site`
                      : "Select a site to load categories"}
                </p>
              </div>
            </div>
          </div>

          <div className="panel rounded-[1.75rem] p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Target Site</p>
                <h3 className="mt-2 text-xl font-semibold text-slate-950">Choose where this workflow publishes</h3>
              </div>
              <Link className="button-muted" href="/account">Manage Sites</Link>
            </div>
            {hasSiteConfigured ? (
              <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {account.wordpressSites.map((site) => (
                  <button
                    key={site.id}
                    type="button"
                    className={`rounded-[1.35rem] border p-4 text-left transition ${
                      site.id === selectedSiteId
                        ? "border-blue-500 bg-blue-50 shadow-sm ring-2 ring-blue-100"
                        : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                    }`}
                    onClick={() => setSelectedSiteId(site.id)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-950">{site.name}</p>
                        <p className="mt-1 break-all text-xs text-slate-600">{site.baseUrl}</p>
                      </div>
                      {site.isDefault ? (
                        <span className="rounded-full bg-slate-900 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-white">
                          Default
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-3 text-xs text-slate-500">Username: {site.username}</p>
                  </button>
                ))}
              </div>
            ) : (
              <div className="mt-5 rounded-[1.25rem] border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-sm text-slate-600">
                Add your first site in <Link href="/account" className="font-semibold underline">Site Settings</Link>.
              </div>
            )}
          </div>

          <div className="panel rounded-[1.75rem] p-5">
            <div className="grid gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,0.65fr)]">
              <div>
                <label className="label">Site categories</label>
                <div className="rounded-[1.25rem] border border-slate-200 bg-slate-50 p-3">
                  {!selectedSite ? (
                    <p className="text-sm text-slate-500">Select a site to load categories.</p>
                  ) : categories.length === 0 ? (
                    <p className="text-sm text-slate-500">
                      {isLoadingCategories ? "Loading categories..." : "No categories found on this site yet."}
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {categories.map((category) => (
                        <button
                          key={category.id}
                          type="button"
                          className={`rounded-full border px-3 py-1.5 text-sm transition ${
                            selectedCategoryIds.includes(category.id)
                              ? "border-blue-500 bg-blue-50 text-blue-950"
                              : "border-slate-300 bg-white text-slate-700 hover:border-slate-400"
                          }`}
                          onClick={() =>
                            setSelectedCategoryIds((current) =>
                              current.includes(category.id)
                                ? current.filter((id) => id !== category.id)
                                : [...current, category.id],
                            )
                          }
                        >
                          {category.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="label">Create category on publish</label>
                  <input className="input" value={newCategoryName} onChange={(event) => setNewCategoryName(event.target.value)} placeholder="Optional new category name" />
                </div>
                <div>
                  <label className="label">SEO provider</label>
                  <div className="grid gap-2">
                    {(["None", "AIOSEO", "Yoast"] as SEOProvider[]).map((provider) => (
                      <button
                        key={provider}
                        type="button"
                        className={`rounded-[1rem] border px-3 py-2 text-left text-sm transition ${
                          seoProvider === provider
                            ? "border-slate-900 bg-slate-900 text-white"
                            : "border-slate-300 bg-white text-slate-700 hover:border-slate-400"
                        }`}
                        onClick={() => setSeoProvider(provider)}
                      >
                        {provider}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="panel rounded-[1.75rem] p-5">
            <div className="grid gap-3 lg:grid-cols-3">
              {workspaceTabs.map(([id, label, subtitle]) => (
                <button
                  key={id}
                  type="button"
                  className={`rounded-[1.35rem] border px-4 py-4 text-left transition ${
                    workspaceMode === id
                      ? "border-blue-500 bg-blue-50 shadow-sm"
                      : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                  }`}
                  onClick={() => setWorkspaceMode(id)}
                >
                  <p className="text-sm font-semibold text-slate-950">{label}</p>
                  <p className="mt-1 text-xs text-slate-600">{subtitle}</p>
                </button>
              ))}
            </div>
          </div>

          {workspaceMode === "manual" ? (
            <>
              <div className="panel rounded-[1.75rem] p-5">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="md:col-span-2">
                    <label className="label">Article title</label>
                    <input className="input" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Example: Best AI Writing Tools for Agencies" />
                  </div>
                  <div className="md:col-span-2">
                    <label className="label">Topic brief</label>
                    <textarea className="textarea min-h-36" value={brief} onChange={(event) => setBrief(event.target.value)} placeholder="Describe angle, audience, structure, and what must be covered." />
                  </div>
                  <div>
                    <label className="label">Keywords</label>
                    <input className="input" value={keywords} onChange={(event) => setKeywords(event.target.value)} placeholder="seo automation, ai publishing, wordpress" />
                  </div>
                  <div>
                    <label className="label">Focus keyword</label>
                    <input className="input" value={seoPayload.focusKeyword} onChange={(event) => setSeoPayload((current) => ({ ...current, focusKeyword: event.target.value }))} placeholder="Primary ranking term" />
                  </div>
                  <div>
                    <label className="label">Tone</label>
                    <select className="select" value={tone} onChange={(event) => setTone(event.target.value)}>
                      {toneOptions.map((option) => (
                        <option key={option} value={option}>{option}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="label">Word count</label>
                    <input type="number" className="input" min={300} max={5000} value={wordCount} onChange={(event) => setWordCount(Math.max(300, Math.min(5000, Number(event.target.value) || 1200)))} />
                  </div>
                  <div>
                    <label className="label">Publish mode</label>
                    <select className="select" value={publishMode} onChange={(event) => setPublishMode(event.target.value as PublishMode)}>
                      <option value="draft">Draft</option>
                      <option value="publish">Publish now</option>
                      <option value="future">Schedule</option>
                    </select>
                  </div>
                  <div>
                    <label className="label">Schedule date/time</label>
                    <input type="datetime-local" className="input" value={scheduledAtLocal} onChange={(event) => setScheduledAtLocal(event.target.value)} disabled={publishMode !== "future"} />
                  </div>
                  <div>
                    <label className="label">In-post images</label>
                    <input type="number" className="input" min={0} max={10} value={inPostImageCount} onChange={(event) => setInPostImageCount(Math.max(0, Math.min(10, Number(event.target.value) || 0)))} />
                  </div>
                  <div>
                    <label className="label">Canonical URL</label>
                    <input className="input" value={seoPayload.canonicalUrl || ""} onChange={(event) => setSeoPayload((current) => ({ ...current, canonicalUrl: event.target.value }))} placeholder="Optional canonical URL" />
                  </div>
                </div>
                <div className="mt-5 flex flex-wrap gap-3">
                  <button type="button" className="button-primary" onClick={handleGenerateDraft} disabled={isBusy}>{isGeneratingDraft ? "Generating..." : "Generate Draft"}</button>
                  <button type="button" className="button-secondary" onClick={handleGenerateImage} disabled={isBusy}>{isGeneratingImage ? "Generating..." : "Generate Image"}</button>
                  <button type="button" className="button-muted" onClick={handlePublishPost} disabled={isBusy || !selectedSiteId}>{isPublishing ? "Publishing..." : "Publish to WordPress"}</button>
                </div>
                {excerpt ? <div className="mt-5 rounded-[1.25rem] border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">{excerpt}</div> : null}
                {suggestedTags.length > 0 ? <div className="mt-4 flex flex-wrap gap-2">{suggestedTags.map((tag) => <span key={tag} className="rounded-full border border-slate-300 bg-white px-3 py-1 text-sm text-slate-700">{tag}</span>)}</div> : null}
              </div>
              <LinkTable links={links} onChange={setLinks} />
              <SeoFields value={seoPayload} onChange={setSeoPayload} />
            </>
          ) : null}

          {workspaceMode === "google-doc" ? (
            <div className="panel rounded-[1.75rem] p-5">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="md:col-span-2">
                  <label className="label">Google Doc link</label>
                  <input className="input" value={googleDocInput} onChange={(event) => setGoogleDocInput(event.target.value)} placeholder="https://docs.google.com/document/d/... or a document ID" />
                </div>
                <div>
                  <label className="label">Publish mode</label>
                  <select className="select" value={googleDocPublishMode} onChange={(event) => setGoogleDocPublishMode(event.target.value as PublishMode)}>
                    <option value="draft">Draft</option>
                    <option value="publish">Publish now</option>
                    <option value="future">Schedule</option>
                  </select>
                </div>
                <div>
                  <label className="label">Schedule date/time</label>
                  <input type="datetime-local" className="input" value={googleDocScheduledAtLocal} onChange={(event) => setGoogleDocScheduledAtLocal(event.target.value)} disabled={googleDocPublishMode !== "future"} />
                </div>
              </div>
              <div className="mt-5 rounded-[1.25rem] border border-blue-200 bg-blue-50 p-4 text-sm text-blue-950">
                Use a normal Google Doc link only. If the doc is private, change sharing to <strong>Anyone with the link can view</strong> or use <strong>File &gt; Share &gt; Publish to web</strong>. No Google service email or private key is needed.
              </div>
              <div className="mt-5">
                <button type="button" className="button-secondary" onClick={handlePublishGoogleDoc} disabled={isBusy || !selectedSiteId}>{isPublishingGoogleDoc ? "Publishing..." : "Import and Publish"}</button>
              </div>
            </div>
          ) : null}

          {workspaceMode === "news" ? (
            <div className="panel rounded-[1.75rem] p-5">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="label">News category</label>
                  <select className="select" value={newsCategory} onChange={(event) => setNewsCategory(event.target.value as (typeof newsCategoryOptions)[number])}>
                    {newsCategoryOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Keyword filter</label>
                  <input className="input" value={newsQuery} onChange={(event) => setNewsQuery(event.target.value)} placeholder="Optional keyword filter" />
                </div>
                <div>
                  <label className="label">Language</label>
                  <input className="input" value={newsLanguage} onChange={(event) => setNewsLanguage(event.target.value)} placeholder="en" />
                </div>
                <div>
                  <label className="label">Max articles</label>
                  <input type="number" className="input" min={1} max={5} value={newsMaxArticles} onChange={(event) => setNewsMaxArticles(Math.max(1, Math.min(5, Number(event.target.value) || 1)))} />
                </div>
                <div>
                  <label className="label">Publish mode</label>
                  <select className="select" value={newsPublishMode} onChange={(event) => setNewsPublishMode(event.target.value as PublishMode)}>
                    <option value="publish">Publish now</option>
                    <option value="future">Schedule</option>
                  </select>
                </div>
                <div>
                  <label className="label">Schedule date/time</label>
                  <input type="datetime-local" className="input" value={newsScheduledAtLocal} onChange={(event) => setNewsScheduledAtLocal(event.target.value)} disabled={newsPublishMode !== "future"} />
                </div>
              </div>
              <div className="mt-5">
                <button type="button" className="button-primary" onClick={handleAutoPublishNews} disabled={isBusy || !selectedSiteId}>{isAutoPublishingNews ? "Processing..." : "Run News Autopilot"}</button>
              </div>
            </div>
          ) : null}
        </section>

        <section className="space-y-5">
          <div className="panel rounded-[1.75rem] p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Current Target</p>
            {selectedSite ? (
              <>
                <h3 className="mt-2 text-xl font-semibold text-slate-950">{selectedSite.name}</h3>
                <p className="mt-2 break-all text-sm text-slate-600">{selectedSite.baseUrl}</p>
                <p className="mt-3 text-sm text-slate-700">Username: {selectedSite.username}</p>
                <p className="mt-1 text-xs text-slate-500">Updated {new Date(selectedSite.updatedAt).toLocaleString()}</p>
              </>
            ) : (
              <p className="mt-3 text-sm text-slate-600">Select a site to enable publishing.</p>
            )}
          </div>

          {generatedImage ? (
            <div className="panel rounded-[1.75rem] p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Featured Image</p>
              <img src={`data:${generatedImage.mimeType};base64,${generatedImage.imageBase64}`} alt={generatedImage.altTextSuggestion} className="mt-4 max-h-72 w-full rounded-[1.35rem] border border-slate-200 object-cover" />
            </div>
          ) : null}

          {publishResult ? <div className="panel rounded-[1.75rem] p-5 text-sm"><p className="font-semibold text-slate-950">Manual publish: #{publishResult.postId}</p><a className="mt-2 block break-all text-blue-700 underline" href={publishResult.link} target="_blank" rel="noreferrer">{publishResult.link}</a></div> : null}
          {googleDocPublishResult ? <div className="panel rounded-[1.75rem] p-5 text-sm"><p className="font-semibold text-slate-950">Google Doc: {googleDocPublishResult.title}</p><a className="mt-2 block break-all text-blue-700 underline" href={googleDocPublishResult.link} target="_blank" rel="noreferrer">{googleDocPublishResult.link}</a></div> : null}
          {newsAutoPublishResult ? <div className="panel rounded-[1.75rem] p-5 text-sm"><p className="font-semibold text-slate-950">{newsAutoPublishResult.published} published / {newsAutoPublishResult.failed} failed</p></div> : null}

          <ArticlePreview html={generatedHtml} links={links} seoProvider={seoProvider} seoPayload={seoPayload} hasGeneratedImage={Boolean(generatedImage)} />
        </section>
      </div>

      {toast ? <StatusToast type={toast.type} message={toast.message} onClose={() => setToast(null)} /> : null}
    </DashboardShell>
  );
}
