"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import {
  Code2,
  Copy,
  ExternalLink,
  Eye,
  ImageIcon,
  MessageSquare,
  PlugZap,
  Save,
  Wand2,
} from "lucide-react";
import ArticlePreview from "@/components/ArticlePreview";
import DashboardLoadError from "@/components/DashboardLoadError";
import DashboardLoading from "@/components/DashboardLoading";
import DashboardShell, { type DashboardNavItem } from "@/components/DashboardShell";
import EmptyState from "@/components/EmptyState";
import LinkTable from "@/components/LinkTable";
import SeoFields from "@/components/SeoFields";
import StatusToast from "@/components/StatusToast";
import TiptapArticleEditor from "@/components/TiptapArticleEditor";
import { slugifyArticle } from "@/lib/slug";
import type {
  HyperlinkInput,
  SEOProvider,
  SeoPayload,
  WordPressSiteSummary,
} from "@/lib/types";

type ToastState = { type: "success" | "error" | "info"; message: string };
type AiProvider = "openai" | "gemini" | "ollama";
type AiModelOption = { value: string; label: string };
type PublishMode = "draft" | "publish" | "future";
type WorkspaceMode = "manual" | "google-doc" | "news";
type DraftViewMode = "preview" | "edit" | "html";
type CategoryOption = { id: number; name: string; slug: string; count?: number };
type TagOption = { id: number; name: string; slug: string; count?: number };
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
  warnings?: string[];
  tokenCharge?: { remaining: number };
};
type GoogleDocPublishResultState = {
  postId?: number;
  title: string;
  link: string;
  status?: string;
  warnings?: string[];
  tokenCharge?: { remaining: number };
};
type SitePublishOutcome = {
  siteId: string;
  siteName: string;
  ok: boolean;
  postId?: number;
  title: string;
  link?: string;
  status?: string;
  warnings?: string[];
  error?: string;
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

const aiProviderOptions: { value: AiProvider; label: string }[] = [
  { value: "openai", label: "OpenAI" },
  { value: "gemini", label: "Gemini" },
  { value: "ollama", label: "Ollama (self-hosted)" },
];

const aiModelOptions: Record<AiProvider, AiModelOption[]> = {
  openai: [
    { value: "gpt-4.1-mini", label: "GPT-4.1 mini" },
    { value: "gpt-4.1", label: "GPT-4.1" },
    { value: "gpt-4o-mini", label: "GPT-4o mini" },
  ],
  gemini: [
    { value: "gemini-3.5-flash", label: "Gemini 3.5 Flash" },
    { value: "gemini-3.7-flash", label: "Gemini 3.7 Flash" },
    { value: "gemini-3.6-flash", label: "Gemini 3.6 Flash" },
    { value: "gemini-3.5-flash-lite", label: "Gemini 3.5 Flash-Lite" },
    { value: "gemini-3.1-flash-lite", label: "Gemini 3.1 Flash-Lite" },
    { value: "gemini-2.5-pro", label: "Gemini 2.5 Pro" },
    { value: "gemini-2.5-flash", label: "Gemini 2.5 Flash" },
    { value: "gemini-1.5-flash", label: "Gemini 1.5 Flash" },
  ],
  ollama: [
    { value: "llama3.1", label: "Llama 3.1" },
    { value: "llama3.2", label: "Llama 3.2" },
    { value: "mistral", label: "Mistral" },
    { value: "gemma2", label: "Gemma 2" },
  ],
};

const getAiProviderLabel = (provider: AiProvider) => {
  if (provider === "gemini") return "Gemini";
  if (provider === "ollama") return "Ollama";
  return "OpenAI";
};

const getDefaultAiModel = (provider: AiProvider) => aiModelOptions[provider][0]?.value || "";

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

const maxEditorImageBytes = 2 * 1024 * 1024;

const workspaceTabs = [
  ["manual", "Manual Studio", "Generate, refine, and publish from a structured brief."],
  ["google-doc", "Google Doc Import", "Ship a document directly from a single share link."],
  ["news", "News Autopilot", "Turn fresh news into publish-ready posts."],
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

function MetricCard({
  label,
  value,
  hint,
  badge,
}: {
  label: string;
  value: string;
  hint: string;
  badge?: string;
}) {
  return (
    <div className="metric-card">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">
            {label}
          </p>
          <p className="mt-2 truncate text-2xl font-semibold text-slate-950">{value}</p>
          <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">{hint}</p>
        </div>
        {badge ? <span className="badge-info shrink-0">{badge}</span> : null}
      </div>
      <div className="mt-4 h-1 rounded-full bg-slate-100">
        <div className="h-1 w-2/3 rounded-full bg-blue-600" />
      </div>
    </div>
  );
}

function ResultSummary({
  label,
  title,
  link,
  status,
  warnings,
}: {
  label: string;
  title: string;
  link?: string;
  status?: string;
  warnings?: string[];
}) {
  return (
    <div className="panel-muted px-4 py-4">
      <div className="flex items-center justify-between gap-3">
        <p className="eyebrow">{label}</p>
        {status ? <span className="badge-info">{status}</span> : null}
      </div>
      <p className="mt-2 text-sm font-semibold text-slate-950">{title}</p>
      {warnings && warnings.length > 0 ? (
        <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900">
          {warnings.map((warning) => (
            <p key={warning}>{warning}</p>
          ))}
        </div>
      ) : null}
      {link ? (
        <a
          className="mt-2 block break-all text-xs text-blue-700 underline"
          href={link}
          target="_blank"
          rel="noreferrer"
        >
          {link}
        </a>
      ) : null}
    </div>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const { data: session, status } = useSession();

  const [workspaceMode, setWorkspaceMode] = useState<WorkspaceMode>("manual");
  const [publicAppUrl, setPublicAppUrl] = useState(
    process.env.NEXT_PUBLIC_APP_URL || "",
  );
  const [account, setAccount] = useState<AccountSummaryState | null>(null);
  const [accountLoadError, setAccountLoadError] = useState<string | null>(null);
  const [selectedSiteId, setSelectedSiteId] = useState("");
  const [selectedSiteIds, setSelectedSiteIds] = useState<string[]>([]);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<number[]>([]);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [tags, setTags] = useState<TagOption[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);
  const [newTagNames, setNewTagNames] = useState("");
  const [seoProvider, setSeoProvider] = useState<SEOProvider>("None");
  const [seoPayload, setSeoPayload] = useState<SeoPayload>(initialSeoPayload);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [title, setTitle] = useState("");
  const [customSlug, setCustomSlug] = useState("");
  const [isSlugEdited, setIsSlugEdited] = useState(false);
  const [brief, setBrief] = useState("");
  const [keywords, setKeywords] = useState("");
  const [tone, setTone] = useState("Professional");
  const [wordCount, setWordCount] = useState(1200);
  const [links, setLinks] = useState<HyperlinkInput[]>([initialLink]);
  const [inPostImageCount, setInPostImageCount] = useState(0);
  const [aiProvider, setAiProvider] = useState<AiProvider>("openai");
  const [aiModel, setAiModel] = useState(getDefaultAiModel("openai"));
  const [skipManualImages, setSkipManualImages] = useState(false);
  const [newsSkipImages, setNewsSkipImages] = useState(false);
  const [googleDocSkipImages, setGoogleDocSkipImages] = useState(false);
  const [generatedHtml, setGeneratedHtml] = useState("");
  const [draftViewMode, setDraftViewMode] = useState<DraftViewMode>("preview");
  const [editPrompt, setEditPrompt] = useState("");
  const [insertImageUrl, setInsertImageUrl] = useState("");
  const [insertImageAlt, setInsertImageAlt] = useState("");
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
  const [publishResults, setPublishResults] = useState<SitePublishOutcome[]>([]);
  const [googleDocPublishResults, setGoogleDocPublishResults] =
    useState<SitePublishOutcome[]>([]);
  const [newsAutoPublishResult, setNewsAutoPublishResult] =
    useState<NewsAutoPublishResultState | null>(null);
  const [isGeneratingDraft, setIsGeneratingDraft] = useState(false);
  const [isEditingDraft, setIsEditingDraft] = useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isPublishingGoogleDoc, setIsPublishingGoogleDoc] = useState(false);
  const [isAutoPublishingNews, setIsAutoPublishingNews] = useState(false);
  const [isLoadingCategories, setIsLoadingCategories] = useState(false);
  const [isLoadingTags, setIsLoadingTags] = useState(false);

  const selectedSite = account?.wordpressSites.find((site) => site.id === selectedSiteId) ?? null;
  const selectedSites = useMemo(
    () =>
      account?.wordpressSites.filter((site) => selectedSiteIds.includes(site.id)) ?? [],
    [account?.wordpressSites, selectedSiteIds],
  );
  const hasSiteConfigured = (account?.wordpressSites.length || 0) > 0;
  const isBusy =
    isGeneratingDraft ||
    isEditingDraft ||
    isGeneratingImage ||
    isPublishing ||
    isPublishingGoogleDoc ||
    isAutoPublishingNews;
  const keywordsCount = parseKeywords(keywords).length;
  const currentSlug = customSlug.trim() || slugifyArticle(title);
  const selectedCategoryNames = categories
    .filter((category) => selectedCategoryIds.includes(category.id))
    .map((category) => category.name);
  const selectedTagNames = tags
    .filter((tag) => selectedTagIds.includes(tag.id))
    .map((tag) => tag.name);
  const availableAiModels = aiModelOptions[aiProvider];

  const stats = useMemo(
    () => [
      {
        label: "Destinations",
        value: `${selectedSites.length}`,
        hint: selectedSites.length
          ? selectedSites.map((site) => site.name).join(", ")
          : "Choose one or more publishing destinations.",
        badge: selectedSites.length > 1 ? "Bulk" : undefined,
      },
      {
        label: "Keyword Set",
        value: `${keywordsCount}`,
        hint: seoPayload.focusKeyword.trim()
          ? `Primary focus: ${seoPayload.focusKeyword}`
          : "Add a focus keyword before generation.",
      },
      {
        label: "Slug Preview",
        value: title.trim() ? currentSlug || "article" : "--",
        hint: excerpt.trim() ? "Summary ready for publish." : "Summary appears after generation.",
      },
    ],
    [currentSlug, excerpt, keywordsCount, selectedSites, seoPayload.focusKeyword, title],
  );

  const loadAccount = async () => {
    setAccountLoadError(null);
    const response = await fetch("/api/me");
    if (!response.ok) throw new Error(await getApiError(response));
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
    setSelectedSiteIds((current) => {
      const availableIds = new Set((data.wordpressSites || []).map((site) => site.id));
      const retained = current.filter((id) => availableIds.has(id));
      if (retained.length > 0) return retained;
      const initialId = data.defaultWordpressSite?.id || data.wordpressSites?.[0]?.id;
      return initialId ? [initialId] : [];
    });
  };

  const loadCategories = async (
    siteId: string,
    showToastOnError = false,
    signal?: AbortSignal,
  ) => {
    try {
      setIsLoadingCategories(true);
      const response = await fetch(
        `/api/wp-categories?siteId=${encodeURIComponent(siteId)}`,
        { signal },
      );
      if (!response.ok) throw new Error(await getApiError(response));
      const data = (await response.json()) as { categories: CategoryOption[] };
      const nextCategories = data.categories || [];
      setCategories(nextCategories);
      setSelectedCategoryIds((current) =>
        current.filter((id) => nextCategories.some((category) => category.id === id)),
      );
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      if (showToastOnError) {
        setToast({
          type: "error",
          message:
            error instanceof Error ? error.message : "Failed to load WordPress categories.",
        });
      }
    } finally {
      if (!signal?.aborted) setIsLoadingCategories(false);
    }
  };

  const loadTags = async (
    siteId: string,
    showToastOnError = false,
    signal?: AbortSignal,
  ) => {
    try {
      setIsLoadingTags(true);
      const response = await fetch(
        `/api/wp-tags?siteId=${encodeURIComponent(siteId)}`,
        { signal },
      );
      if (!response.ok) throw new Error(await getApiError(response));
      const data = (await response.json()) as { tags: TagOption[] };
      const nextTags = data.tags || [];
      setTags(nextTags);
      setSelectedTagIds((current) =>
        current.filter((id) => nextTags.some((tag) => tag.id === id)),
      );
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      if (showToastOnError) {
        setToast({
          type: "error",
          message:
            error instanceof Error ? error.message : "Failed to load WordPress tags.",
        });
      }
    } finally {
      if (!signal?.aborted) setIsLoadingTags(false);
    }
  };

  useEffect(() => {
    setPublicAppUrl(window.location.origin);
  }, []);

  useEffect(() => {
    if (!isSlugEdited) {
      setCustomSlug(slugifyArticle(title));
    }
  }, [isSlugEdited, title]);

  useEffect(() => {
    if (!availableAiModels.some((model) => model.value === aiModel)) {
      setAiModel(getDefaultAiModel(aiProvider));
    }
  }, [aiModel, aiProvider, availableAiModels]);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login");
      return;
    }
    if (status !== "authenticated") return;
    void loadAccount().catch((error: unknown) => {
      const message =
        error instanceof Error ? error.message : "Failed to load account details.";
      setAccountLoadError(message);
      setToast({
        type: "error",
        message,
      });
    });
  }, [router, status]);

  useEffect(() => {
    if (!selectedSiteId) {
      setCategories([]);
      setSelectedCategoryIds([]);
      setTags([]);
      setSelectedTagIds([]);
      return;
    }
    setSelectedCategoryIds([]);
    setSelectedTagIds([]);
    const controller = new AbortController();
    void loadCategories(selectedSiteId, false, controller.signal);
    void loadTags(selectedSiteId, false, controller.signal);
    return () => controller.abort();
  }, [selectedSiteId]);

  const syncBalance = (remaining?: number) => {
    if (typeof remaining !== "number") return;
    setAccount((current) => (current ? { ...current, tokenBalance: remaining } : current));
  };

  const handleAiProviderChange = (provider: AiProvider) => {
    setAiProvider(provider);
    setAiModel(getDefaultAiModel(provider));
  };

  const toggleDestination = (siteId: string) => {
    if (selectedSiteIds.includes(siteId)) {
      const next = selectedSiteIds.filter((id) => id !== siteId);
      setSelectedSiteIds(next);
      if (selectedSiteId === siteId) setSelectedSiteId(next[0] || "");
      return;
    }

    setSelectedSiteIds([...selectedSiteIds, siteId]);
    if (!selectedSiteId) setSelectedSiteId(siteId);
  };

  const getPublicAppUrl = () => {
    return publicAppUrl || process.env.NEXT_PUBLIC_APP_URL || "";
  };

  const getMcpConnectorUrl = () => `${getPublicAppUrl().replace(/\/+$/, "")}/api/mcp`;

  const copyText = async (value: string, successMessage: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setToast({ type: "success", message: successMessage });
    } catch {
      setToast({
        type: "error",
        message: "Could not copy to clipboard. Select and copy the text manually.",
      });
    }
  };

  const openChatGpt = () => {
    window.open("https://chatgpt.com/", "_blank", "noopener,noreferrer");
  };

  const handleConnectChatGpt = async () => {
    await copyText(
      getMcpConnectorUrl(),
      "MCP connector URL copied. Paste it into ChatGPT custom connector settings.",
    );
    openChatGpt();
  };

  const buildChatGptCommand = () => {
    const destinations = selectedSites.length
      ? selectedSites.map((site) => site.name).join(", ")
      : "my connected WordPress site";
    const safeHtml = generatedHtml.trim()
      ? generatedHtml.trim().slice(0, 12000)
      : "";

    return [
      "Use my AI Article Publisher MCP connector.",
      "",
      `Target site(s): ${destinations}`,
      `Title: ${title.trim() || "Untitled article"}`,
      `Focus keyword: ${seoPayload.focusKeyword.trim() || "Choose the best focus keyword"}`,
      `Tone: ${tone}`,
      `Target word count: ${wordCount}`,
      "",
      editPrompt.trim()
        ? `Edit instructions: ${editPrompt.trim()}`
        : "Task: review this article idea, improve it, and create a WordPress draft. Do not publish unless I explicitly ask.",
      "",
      brief.trim() ? `Brief:\n${brief.trim()}` : "",
      keywords.trim() ? `Keywords:\n${keywords.trim()}` : "",
      safeHtml
        ? `Current article HTML:\n${safeHtml}${generatedHtml.length > safeHtml.length ? "\n\n[HTML truncated for ChatGPT prompt. Ask me if you need the full article.]" : ""}`
        : "",
      "",
      "After editing, keep the result as a draft unless I explicitly say to publish.",
    ]
      .filter(Boolean)
      .join("\n");
  };

  const escapeHtmlAttribute = (value: string) =>
    value
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

  const appendHtmlToDraft = (htmlToAppend: string) => {
    const nextHtml = `${generatedHtml.trim()}\n${htmlToAppend}`.trim();
    setGeneratedHtml(nextHtml);
    setDraftViewMode("edit");
  };

  const insertImageIntoDraft = (src: string, altText: string) => {
    if (!src.trim()) {
      throw new Error("Add an image URL or upload an image first.");
    }
    appendHtmlToDraft(
      `<figure class="wp-block-image size-large"><img src="${escapeHtmlAttribute(
        src.trim(),
      )}" alt="${escapeHtmlAttribute(
        altText.trim(),
      )}" loading="lazy" decoding="async" /></figure>`,
    );
  };

  const handleInsertImageUrl = () => {
    try {
      insertImageIntoDraft(insertImageUrl, insertImageAlt);
      setInsertImageUrl("");
      setInsertImageAlt("");
      setToast({ type: "success", message: "Image inserted into the article editor." });
    } catch (error) {
      setToast({
        type: "error",
        message: error instanceof Error ? error.message : "Failed to insert image.",
      });
    }
  };

  const handleUploadEditorImage = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setToast({ type: "error", message: "Choose an image file." });
      return;
    }
    if (file.size > maxEditorImageBytes) {
      setToast({
        type: "error",
        message: "Choose an image under 2 MB for manual editor uploads.",
      });
      return;
    }

    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () =>
        typeof reader.result === "string"
          ? resolve(reader.result)
          : reject(new Error("Could not read image file."));
      reader.onerror = () => reject(new Error("Could not read image file."));
      reader.readAsDataURL(file);
    });

    insertImageIntoDraft(dataUrl, insertImageAlt || file.name.replace(/\.[^.]+$/, ""));
    setInsertImageAlt("");
    setToast({
      type: "success",
      message: "Image added. It will be uploaded to WordPress media during publish.",
    });
  };

  const handleOpenDraftInChatGpt = async () => {
    await copyText(
      buildChatGptCommand(),
      "ChatGPT command copied. Paste it into ChatGPT with the connector enabled.",
    );
    openChatGpt();
  };

  const applyGeneratedArticle = (data: {
    html: string;
    meta: {
      title?: string;
      excerpt: string;
      suggestedTags: string[];
      seo: SeoPayload;
    };
    tokenCharge?: { amount: number; remaining: number };
  }) => {
    setGeneratedHtml(data.html);
    if (data.meta.title) {
      setTitle(data.meta.title);
      if (!isSlugEdited) {
        setCustomSlug(slugifyArticle(data.meta.title));
      }
    }
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
  };

  const handleGenerateDraft = async () => {
    try {
      if (!title.trim() || !brief.trim()) throw new Error("Title and topic brief are required.");
      if (!seoPayload.focusKeyword.trim()) {
        throw new Error("Focus keyword is required before draft generation.");
      }
      setIsGeneratingDraft(true);
      setPublishResults([]);
      setGoogleDocPublishResults([]);
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
          provider: aiProvider,
          model: aiModel.trim() || undefined,
        }),
      });
      if (!response.ok) throw new Error(await getApiError(response));
      const data = (await response.json()) as {
        html: string;
        meta: { title?: string; excerpt: string; suggestedTags: string[]; seo: SeoPayload };
        tokenCharge?: { amount: number; remaining: number };
      };
      applyGeneratedArticle(data);
      setDraftViewMode("preview");
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

  const handleEditDraft = async () => {
    try {
      if (!generatedHtml.trim()) throw new Error("Generate a draft before editing.");
      if (!editPrompt.trim()) throw new Error("Add edit instructions first.");
      if (!title.trim() || !brief.trim()) throw new Error("Title and topic brief are required.");
      setIsEditingDraft(true);
      setPublishResults([]);
      const response = await fetch("/api/edit-article", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          brief: brief.trim(),
          html: generatedHtml,
          excerpt: excerpt.trim() || undefined,
          editPrompt: editPrompt.trim(),
          keywords: parseKeywords(keywords),
          focusKeyword: seoPayload.focusKeyword.trim() || title.trim(),
          tone,
          wordCount: Number(wordCount),
          links: normalizeLinks(links),
          provider: aiProvider,
          model: aiModel.trim() || undefined,
        }),
      });
      if (!response.ok) throw new Error(await getApiError(response));
      const data = (await response.json()) as {
        html: string;
        meta: { title?: string; excerpt: string; suggestedTags: string[]; seo: SeoPayload };
        tokenCharge?: { amount: number; remaining: number };
      };
      applyGeneratedArticle(data);
      setDraftViewMode("preview");
      setToast({
        type: "success",
        message: data.tokenCharge
          ? `Draft edited. ${data.tokenCharge.amount} tokens used.`
          : "Draft edited successfully.",
      });
    } catch (error) {
      setToast({
        type: "error",
        message: error instanceof Error ? error.message : "Failed to edit draft.",
      });
    } finally {
      setIsEditingDraft(false);
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
      if (!response.ok) throw new Error(await getApiError(response));
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
      if (selectedSites.length === 0) {
        throw new Error("Select at least one WordPress destination before publishing.");
      }
      if (!generatedHtml.trim()) throw new Error("Generate a draft before publishing.");
      if (!excerpt.trim()) throw new Error("Excerpt is required before publishing.");
      if (publishMode === "future" && !scheduledAtLocal.trim()) {
        throw new Error("Select a future schedule date/time first.");
      }
      setIsPublishing(true);
      setPublishResults([]);
      const outcomes: SitePublishOutcome[] = [];
      for (const site of selectedSites) {
        const response = await fetch("/api/publish", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            siteId: site.id,
            title: title.trim(),
            slug: currentSlug || undefined,
            brief: brief.trim(),
            html: generatedHtml,
            links: normalizeLinks(links),
            excerpt: excerpt.trim(),
            status: publishMode,
            scheduledAt:
              publishMode === "future" ? toIsoFromLocalDateTime(scheduledAtLocal) : undefined,
            featuredImageBase64: skipManualImages ? undefined : generatedImage?.imageBase64,
            featuredImageMime: skipManualImages ? undefined : generatedImage?.mimeType,
            inPostImageCount: skipManualImages ? 0 : inPostImageCount,
            selectedCategoryIds: site.id === selectedSiteId ? selectedCategoryIds : [],
            selectedCategoryNames,
            newCategoryName: newCategoryName.trim(),
            selectedTagIds: site.id === selectedSiteId ? selectedTagIds : [],
            selectedTagNames,
            newTagNames,
            suggestedTags,
            seoProvider,
            seoPayload,
          }),
        });
        if (!response.ok) {
          outcomes.push({
            siteId: site.id,
            siteName: site.name,
            ok: false,
            title: title.trim(),
            error: await getApiError(response),
          });
          setPublishResults([...outcomes]);
          continue;
        }
        const data = (await response.json()) as PublishResultState;
        syncBalance(data.tokenCharge?.remaining);
        outcomes.push({
          siteId: site.id,
          siteName: site.name,
          ok: true,
          postId: data.postId,
          title: `Post #${data.postId}`,
          link: data.link,
          status: data.status,
          warnings: data.warnings,
        });
        setPublishResults([...outcomes]);
      }
      if (newCategoryName.trim()) {
        setNewCategoryName("");
        void loadCategories(selectedSiteId, false);
      }
      if (newTagNames.trim() || suggestedTags.length > 0) {
        setNewTagNames("");
        void loadTags(selectedSiteId, false);
      }
      const succeeded = outcomes.filter((outcome) => outcome.ok).length;
      const failed = outcomes.length - succeeded;
      setToast({
        type: failed > 0 ? "info" : "success",
        message: failed > 0
          ? `Published to ${succeeded} site(s); ${failed} failed.`
          : `Published to ${succeeded} site(s).`,
      });
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
      if (selectedSites.length === 0) {
        throw new Error("Select at least one WordPress destination before importing a Google Doc.");
      }
      if (!googleDocInput.trim()) throw new Error("Google Doc URL or ID is required.");
      if (googleDocPublishMode === "future" && !googleDocScheduledAtLocal.trim()) {
        throw new Error("Select a future schedule date/time first.");
      }
      setIsPublishingGoogleDoc(true);
      setGoogleDocPublishResults([]);
      const outcomes: SitePublishOutcome[] = [];
      for (const site of selectedSites) {
        const response = await fetch("/api/google-doc-publish", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            siteId: site.id,
            document: googleDocInput.trim(),
            status: googleDocPublishMode,
            scheduledAt:
              googleDocPublishMode === "future"
                ? toIsoFromLocalDateTime(googleDocScheduledAtLocal)
                : undefined,
            selectedCategoryIds: site.id === selectedSiteId ? selectedCategoryIds : [],
            selectedCategoryNames,
            newCategoryName: newCategoryName.trim(),
            selectedTagIds: site.id === selectedSiteId ? selectedTagIds : [],
            selectedTagNames,
            newTagNames,
            seoProvider,
            skipImages: googleDocSkipImages,
          }),
        });
        if (!response.ok) {
          outcomes.push({
            siteId: site.id,
            siteName: site.name,
            ok: false,
            title: googleDocInput.trim(),
            error: await getApiError(response),
          });
          setGoogleDocPublishResults([...outcomes]);
          continue;
        }
        const data = (await response.json()) as GoogleDocPublishResultState;
        syncBalance(data.tokenCharge?.remaining);
        outcomes.push({
          siteId: site.id,
          siteName: site.name,
          ok: true,
          postId: data.postId,
          title: data.title,
          link: data.link,
          status: data.status,
          warnings: data.warnings,
        });
        setGoogleDocPublishResults([...outcomes]);
      }
      if (newCategoryName.trim()) {
        setNewCategoryName("");
        void loadCategories(selectedSiteId, false);
      }
      if (newTagNames.trim()) {
        setNewTagNames("");
        void loadTags(selectedSiteId, false);
      }
      const succeeded = outcomes.filter((outcome) => outcome.ok).length;
      const failed = outcomes.length - succeeded;
      setToast({
        type: failed > 0 ? "info" : "success",
        message: failed > 0
          ? `Google Doc published to ${succeeded} site(s); ${failed} failed.`
          : `Google Doc published to ${succeeded} site(s).`,
      });
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
      if (!selectedSiteId) throw new Error("Select a WordPress site before running news autopilot.");
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
          selectedTagIds,
          newTagNames,
          inPostImageCount,
          seoProvider,
          provider: aiProvider,
          model: aiModel.trim() || undefined,
          skipImages: newsSkipImages,
        }),
      });
      if (!response.ok) throw new Error(await getApiError(response));
      const data = (await response.json()) as NewsAutoPublishResultState;
      setNewsAutoPublishResult(data);
      syncBalance(data.tokenCharge?.remaining);
      if (newCategoryName.trim()) {
        setNewCategoryName("");
        void loadCategories(selectedSiteId, false);
      }
      if (newTagNames.trim()) {
        setNewTagNames("");
        void loadTags(selectedSiteId, false);
      }
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

  if (status === "loading") return <DashboardLoading title="Loading workspace..." />;
  if (!account && accountLoadError) {
    return (
      <DashboardLoadError
        title="Unable to open your workspace"
        message={accountLoadError}
        onRetry={() => void loadAccount().catch((error: unknown) => {
          const message =
            error instanceof Error ? error.message : "Failed to load account details.";
          setAccountLoadError(message);
        })}
        onSignOut={() => void signOut({ callbackUrl: "/login" })}
      />
    );
  }
  if (!account) return <DashboardLoading title="Loading workspace..." />;
  if (status === "unauthenticated") return null;

  return (
    <DashboardShell
      title="Publishing Workspace"
      subtitle="Choose a site, select a workflow, and push high-quality content through a tighter production dashboard."
      role={account.role}
      userLabel={account.name || session?.user?.email || "User"}
      userEmail={session?.user?.email || null}
      tokenBalance={account.tokenBalance}
      navItems={
        [
          { href: "/app/dashboard", label: "Workspace", hint: "Drafts, imports, and autopilot", group: "Workspace", icon: "workspace" },
          { href: "/billing", label: "Billing", hint: "Packages and token usage", group: "Revenue", icon: "billing" },
          { href: "/account", label: "Sites", hint: "Manage connected WordPress sites", group: "Settings", icon: "sites" },
          { href: "/account#ai-keys", label: "AI Keys", hint: "OpenAI and Gemini credentials", group: "Settings", icon: "settings" },
          { href: "/admin", label: "Admin", hint: "Users and packages", visible: account.role === "ADMIN", group: "Operations", icon: "admin" },
        ] satisfies DashboardNavItem[]
      }
    >
      {!hasSiteConfigured ? (
        <div className="panel px-4 py-4 md:px-5">
          <EmptyState
            title="No WordPress site connected"
            description="Connect a client site first so the workspace can load categories and unlock publishing."
            action={<Link href="/account" className="button-primary">Open site settings</Link>}
          />
        </div>
      ) : null}

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_360px]">
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            {stats.map((item) => (
              <MetricCard key={item.label} label={item.label} value={item.value} hint={item.hint} badge={item.badge} />
            ))}
          </div>

          <section className="panel px-4 py-4 md:px-5">
            <div className="section-header">
              <div>
                <p className="eyebrow">Target Site</p>
                <h2 className="mt-1 text-sm font-semibold text-slate-950">Publishing destinations</h2>
                <p className="mt-1 text-xs leading-5 text-slate-500">Select every site that should receive the article. Choose one taxonomy source for browsing categories and tags.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {hasSiteConfigured ? (
                  <button
                    type="button"
                    className="button-muted"
                    onClick={() => {
                      const allSelected =
                        selectedSiteIds.length === account.wordpressSites.length;
                      if (allSelected) {
                        setSelectedSiteIds([]);
                        setSelectedSiteId("");
                        return;
                      }
                      setSelectedSiteIds(account.wordpressSites.map((site) => site.id));
                      if (!selectedSiteId) setSelectedSiteId(account.wordpressSites[0]?.id || "");
                    }}
                  >
                    {selectedSiteIds.length === account.wordpressSites.length
                      ? "Clear all"
                      : "Select all"}
                  </button>
                ) : null}
                <Link className="button-muted" href="/account">Manage sites</Link>
              </div>
            </div>

            {hasSiteConfigured ? (
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {account.wordpressSites.map((site) => (
                  <div
                    key={site.id}
                    className={`rounded-2xl border px-4 py-4 text-left transition ${
                      selectedSiteIds.includes(site.id)
                        ? "border-blue-200 bg-blue-50"
                        : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-950">{site.name}</p>
                        <p className="mt-1 break-all text-xs text-slate-500">{site.baseUrl}</p>
                      </div>
                      {site.isDefault ? <span className="badge-info">Default</span> : null}
                    </div>
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs text-slate-500">User: {site.username}</span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          className={site.id === selectedSiteId ? "badge-success" : "badge-neutral"}
                          onClick={() => {
                            setSelectedSiteId(site.id);
                            setSelectedSiteIds((current) =>
                              current.includes(site.id) ? current : [...current, site.id],
                            );
                          }}
                        >
                          {site.id === selectedSiteId ? "Taxonomy source" : "Use taxonomy"}
                        </button>
                        <button
                          type="button"
                          className={selectedSiteIds.includes(site.id) ? "button-secondary" : "button-muted"}
                          onClick={() => toggleDestination(site.id)}
                        >
                          {selectedSiteIds.includes(site.id) ? "Selected" : "Add"}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-4">
                <EmptyState
                  title="No sites available"
                  description="Add your first WordPress connection in Site Settings."
                  action={<Link href="/account" className="button-muted">Go to sites</Link>}
                />
              </div>
            )}
          </section>

          <section className="panel px-4 py-4 md:px-5">
            <div className="section-header">
              <div>
                <p className="eyebrow">Workflow</p>
                <h2 className="mt-1 text-sm font-semibold text-slate-950">Choose how content gets published</h2>
              </div>
            </div>
            <div className="mt-4 grid gap-3 lg:grid-cols-3">
              {workspaceTabs.map(([id, label, description]) => (
                <button
                  key={id}
                  type="button"
                  className={`rounded-2xl border px-4 py-4 text-left transition ${
                    workspaceMode === id
                      ? "border-blue-200 bg-blue-50"
                      : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                  }`}
                  onClick={() => setWorkspaceMode(id)}
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium text-slate-950">{label}</p>
                    {workspaceMode === id ? <span className="badge-info">Active</span> : null}
                  </div>
                  <p className="mt-2 text-xs leading-5 text-slate-500">{description}</p>
                </button>
              ))}
            </div>
          </section>

          <section className="panel px-4 py-4 md:px-5">
            <div className="section-header">
              <div>
                <p className="eyebrow">Publishing Rules</p>
                <h2 className="mt-1 text-sm font-semibold text-slate-950">Categories, tags, and SEO provider</h2>
              </div>
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,0.7fr)]">
              <div className="space-y-4">
              <div className="panel-muted px-4 py-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-semibold text-slate-900">Site categories</p>
                  {isLoadingCategories ? <span className="badge-neutral">Loading</span> : null}
                </div>
                <div className="mt-3">
                  {!selectedSite ? (
                    <EmptyState title="No site selected" description="Choose a site to load categories." />
                  ) : categories.length === 0 ? (
                    <EmptyState
                      title={isLoadingCategories ? "Loading categories" : "No categories found"}
                      description={isLoadingCategories ? "Pulling taxonomy from WordPress." : "This site does not currently expose any categories."}
                    />
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {categories.map((category) => {
                        const selected = selectedCategoryIds.includes(category.id);
                        return (
                          <button
                            key={category.id}
                            type="button"
                            className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                              selected
                                ? "border-blue-200 bg-blue-50 text-blue-800"
                                : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
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
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

                <div className="panel-muted px-4 py-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs font-semibold text-slate-900">Site tags</p>
                    {isLoadingTags ? <span className="badge-neutral">Loading</span> : null}
                  </div>
                  <div className="mt-3">
                    {!selectedSite ? (
                      <EmptyState title="No site selected" description="Choose a site to load tags." />
                    ) : tags.length === 0 ? (
                      <EmptyState
                        title={isLoadingTags ? "Loading tags" : "No tags found"}
                        description={isLoadingTags ? "Pulling tags from WordPress." : "This site does not currently expose any tags."}
                      />
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {tags.map((tag) => {
                          const selected = selectedTagIds.includes(tag.id);
                          return (
                            <button
                              key={tag.id}
                              type="button"
                              className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                                selected
                                  ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                                  : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                              }`}
                              onClick={() =>
                                setSelectedTagIds((current) =>
                                  current.includes(tag.id)
                                    ? current.filter((id) => id !== tag.id)
                                    : [...current, tag.id],
                                )
                              }
                            >
                              {tag.name}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="panel-muted px-4 py-4">
                  <label className="label">Create category on publish</label>
                  <input className="input" value={newCategoryName} onChange={(event) => setNewCategoryName(event.target.value)} placeholder="Optional new category" />
                  <p className="helper">Only used if the category does not already exist.</p>
                </div>

                <div className="panel-muted px-4 py-4">
                  <label className="label">Create tags on publish</label>
                  <input className="input" value={newTagNames} onChange={(event) => setNewTagNames(event.target.value)} placeholder="ai publishing, wordpress automation" />
                  <p className="helper">Comma-separated tags are created if missing, then attached to the post.</p>
                </div>

                <div className="panel-muted px-4 py-4">
                  <label className="label">SEO provider</label>
                  <div className="grid gap-2">
                    {(["None", "AIOSEO", "Yoast"] as SEOProvider[]).map((provider) => (
                      <button
                        key={provider}
                        type="button"
                        className={`rounded-lg border px-3 py-2 text-left text-sm font-medium transition ${
                          seoProvider === provider
                            ? "border-slate-900 bg-slate-900 text-white"
                            : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
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
          </section>
          {workspaceMode === "manual" ? (
            <>
              <section className="panel px-4 py-4 md:px-5">
                <div className="section-header">
                  <div>
                    <p className="eyebrow">Manual Studio</p>
                    <h2 className="mt-1 text-sm font-semibold text-slate-950">Build a draft from a brief</h2>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="badge-neutral">{tone}</span>
                    <span className="badge-neutral">{wordCount} words</span>
                  </div>
                </div>

                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <div className="md:col-span-2">
                    <label className="label">Article title</label>
                    <input className="input" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Best AI Writing Tools for Agencies" />
                  </div>
                  <div className="md:col-span-2">
                    <div className="flex items-center justify-between gap-3">
                      <label className="label">Post slug</label>
                      <button
                        type="button"
                        className="text-xs font-semibold text-blue-700 hover:text-blue-800"
                        onClick={() => {
                          setCustomSlug(slugifyArticle(title));
                          setIsSlugEdited(false);
                        }}
                      >
                        Use title
                      </button>
                    </div>
                    <input
                      className="input"
                      value={customSlug}
                      onChange={(event) => {
                        setIsSlugEdited(true);
                        setCustomSlug(slugifyArticle(event.target.value));
                      }}
                      placeholder="best-ai-writing-tools-for-agencies"
                    />
                    <p className="helper">This becomes the WordPress permalink slug. Use lowercase words separated by hyphens.</p>
                  </div>
                  <div className="md:col-span-2">
                    <label className="label">Topic brief</label>
                    <textarea className="textarea min-h-[160px]" value={brief} onChange={(event) => setBrief(event.target.value)} placeholder="Describe the angle, target reader, objections, structure, and proof points." />
                    <p className="helper">Use this description for placement notes. The Link Rules table tells the generator which URLs and anchor text to include, whether each link is required, whether it is dofollow or nofollow, and all published links open in a new tab.</p>
                  </div>
                  <div>
                    <label className="label">Keywords</label>
                    <input className="input" value={keywords} onChange={(event) => setKeywords(event.target.value)} placeholder="seo automation, ai publishing, wordpress" />
                    <p className="helper">Comma-separated support terms for clustering and tags.</p>
                  </div>
                  <div>
                    <label className="label">Focus keyword</label>
                    <input className="input" value={seoPayload.focusKeyword} onChange={(event) => setSeoPayload((current) => ({ ...current, focusKeyword: event.target.value }))} placeholder="Primary ranking term" />
                    <p className="helper">Required before generating a draft.</p>
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
                    <label className="label">AI engine</label>
                    <select className="select" value={aiProvider} onChange={(event) => handleAiProviderChange(event.target.value as AiProvider)}>
                      {aiProviderOptions.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="label">Model ({getAiProviderLabel(aiProvider)})</label>
                    <select className="select" value={aiModel} onChange={(event) => setAiModel(event.target.value)}>
                      {availableAiModels.map((model) => (
                        <option key={model.value} value={model.value}>{model.label}</option>
                      ))}
                    </select>
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
                    <label className="label">Schedule date / time</label>
                    <input type="datetime-local" className="input" value={scheduledAtLocal} onChange={(event) => setScheduledAtLocal(event.target.value)} disabled={publishMode !== "future"} />
                  </div>
                  <div>
                    <label className="label">In-post images</label>
                    <input type="number" className="input" min={0} max={10} value={inPostImageCount} onChange={(event) => setInPostImageCount(Math.max(0, Math.min(10, Number(event.target.value) || 0)))} disabled={skipManualImages} />
                  </div>
                  <div>
                    <label className="label">Canonical URL</label>
                    <input className="input" value={seoPayload.canonicalUrl || ""} onChange={(event) => setSeoPayload((current) => ({ ...current, canonicalUrl: event.target.value }))} placeholder="Optional canonical URL" />
                  </div>
                  <div className="flex items-end">
                    <label className="flex items-center gap-2 text-sm text-slate-700">
                      <input type="checkbox" checked={skipManualImages} onChange={(event) => setSkipManualImages(event.target.checked)} />
                      Skip images (add manually later)
                    </label>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <button type="button" className="button-primary" onClick={handleGenerateDraft} disabled={isBusy}>
                    <Wand2 className="h-4 w-4" />
                    {isGeneratingDraft ? "Generating..." : "Generate draft"}
                  </button>
                  <button type="button" className="button-muted" onClick={handleGenerateImage} disabled={isBusy || skipManualImages}>
                    <ImageIcon className="h-4 w-4" />
                    {isGeneratingImage ? "Generating..." : "Generate image"}
                  </button>
                  <button type="button" className="button-secondary" onClick={handlePublishPost} disabled={isBusy || selectedSites.length === 0}>
                    <Save className="h-4 w-4" />
                    {isPublishing ? `Publishing to ${selectedSites.length} site(s)...` : `Publish to ${selectedSites.length || 0} site(s)`}
                  </button>
                </div>

                <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
                  <div className="panel-muted px-4 py-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="eyebrow">Edit Draft</p>
                        <h3 className="mt-1 text-sm font-semibold text-slate-950">Revision prompt</h3>
                      </div>
                      {generatedHtml ? <span className="badge-success">Ready</span> : <span className="badge-neutral">Waiting</span>}
                    </div>
                    <textarea
                      className="textarea mt-3 min-h-[150px]"
                      value={editPrompt}
                      onChange={(event) => setEditPrompt(event.target.value)}
                      placeholder="Example: make the intro shorter, add a pricing comparison section, and make the conclusion more persuasive."
                    />
                    <button
                      type="button"
                      className="button-primary mt-3 w-full"
                      onClick={handleEditDraft}
                      disabled={isBusy || !generatedHtml.trim()}
                    >
                      <Wand2 className="h-4 w-4" />
                      {isEditingDraft ? "Editing..." : "Apply edit prompt"}
                    </button>
                  </div>

                  <div className="panel-muted px-4 py-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="eyebrow">Article Workspace</p>
                        <h3 className="mt-1 text-sm font-semibold text-slate-950">Review and manual edits</h3>
                      </div>
                      <div className="inline-flex rounded-lg border border-slate-200 bg-white p-1">
                        <button
                          type="button"
                          className={`inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                            draftViewMode === "preview"
                              ? "bg-slate-900 text-white"
                              : "text-slate-600 hover:bg-slate-50"
                          }`}
                          onClick={() => setDraftViewMode("preview")}
                        >
                          <Eye className="h-3.5 w-3.5" />
                          Preview
                        </button>
                        <button
                          type="button"
                          className={`inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                            draftViewMode === "edit"
                              ? "bg-slate-900 text-white"
                              : "text-slate-600 hover:bg-slate-50"
                          }`}
                          onClick={() => setDraftViewMode("edit")}
                        >
                          <Wand2 className="h-3.5 w-3.5" />
                          Edit
                        </button>
                        <button
                          type="button"
                          className={`inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                            draftViewMode === "html"
                              ? "bg-slate-900 text-white"
                              : "text-slate-600 hover:bg-slate-50"
                          }`}
                          onClick={() => setDraftViewMode("html")}
                        >
                          <Code2 className="h-3.5 w-3.5" />
                          HTML
                        </button>
                      </div>
                    </div>
                    <div className="mt-3 grid gap-2 rounded-lg border border-slate-200 bg-white p-3">
                      <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)]">
                        <input
                          className="input"
                          value={insertImageUrl}
                          onChange={(event) => setInsertImageUrl(event.target.value)}
                          placeholder="https://example.com/image.jpg"
                        />
                        <input
                          className="input"
                          value={insertImageAlt}
                          onChange={(event) => setInsertImageAlt(event.target.value)}
                          placeholder="Image alt text"
                        />
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          className="button-muted"
                          onClick={handleInsertImageUrl}
                          disabled={!generatedHtml.trim()}
                        >
                          <ImageIcon className="h-4 w-4" />
                          Insert image URL
                        </button>
                        <label className={`button-muted cursor-pointer ${!generatedHtml.trim() ? "pointer-events-none opacity-50" : ""}`}>
                          <ImageIcon className="h-4 w-4" />
                          Upload image into article
                          <input
                            type="file"
                            accept="image/*"
                            className="sr-only"
                            disabled={!generatedHtml.trim()}
                            onChange={(event) => {
                              void handleUploadEditorImage(event.target.files?.[0]);
                              event.target.value = "";
                            }}
                          />
                        </label>
                        <button
                          type="button"
                          className="button-muted"
                          disabled={!generatedHtml.trim() || !generatedImage}
                          onClick={() => {
                            if (!generatedImage) return;
                            insertImageIntoDraft(
                              `data:${generatedImage.mimeType};base64,${generatedImage.imageBase64}`,
                              insertImageAlt || generatedImage.altTextSuggestion,
                            );
                            setInsertImageAlt("");
                            setToast({
                              type: "success",
                              message:
                                "Generated image inserted into the article body.",
                            });
                          }}
                        >
                          <ImageIcon className="h-4 w-4" />
                          Insert generated image
                        </button>
                      </div>
                      <p className="text-xs leading-5 text-slate-500">
                        Uploaded editor images are inserted for review now and uploaded to WordPress media when you publish.
                      </p>
                    </div>
                    {draftViewMode === "html" ? (
                      <textarea
                        className="textarea mt-3 min-h-[360px] font-mono text-xs leading-6"
                        value={generatedHtml}
                        onChange={(event) => setGeneratedHtml(event.target.value)}
                        placeholder="<h2>Your generated article HTML will appear here.</h2>"
                      />
                    ) : draftViewMode === "edit" && generatedHtml ? (
                      <TiptapArticleEditor html={generatedHtml} onChange={setGeneratedHtml} />
                    ) : generatedHtml ? (
                      <article
                        className="mt-3 max-h-[420px] overflow-auto rounded-lg border border-slate-200 bg-white px-4 py-4 text-sm leading-7 text-slate-700 [&_h2]:mt-6 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-slate-950 [&_h3]:mt-5 [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:text-slate-950 [&_li]:ml-5 [&_li]:list-disc [&_p]:my-3"
                        dangerouslySetInnerHTML={{ __html: generatedHtml }}
                      />
                    ) : (
                      <div className="mt-3">
                        <EmptyState title="No draft yet" description="Generate a draft, then refine it here before publishing." />
                      </div>
                    )}
                  </div>
                </div>

                {excerpt ? (
                  <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Draft Summary</p>
                    <p className="mt-2 text-sm leading-6 text-slate-700">{excerpt}</p>
                  </div>
                ) : null}
                {suggestedTags.length > 0 ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {suggestedTags.map((tag) => (
                      <span key={tag} className="badge-neutral">{tag}</span>
                    ))}
                  </div>
                ) : null}
              </section>
              <LinkTable links={links} onChange={setLinks} />
              <SeoFields value={seoPayload} onChange={setSeoPayload} />
            </>
          ) : null}

          {workspaceMode === "google-doc" ? (
            <section className="panel px-4 py-4 md:px-5">
              <div className="section-header">
                <div>
                  <p className="eyebrow">Google Doc Import</p>
                  <h2 className="mt-1 text-sm font-semibold text-slate-950">Publish from a document link</h2>
                </div>
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-2">
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
                  <label className="label">Schedule date / time</label>
                  <input type="datetime-local" className="input" value={googleDocScheduledAtLocal} onChange={(event) => setGoogleDocScheduledAtLocal(event.target.value)} disabled={googleDocPublishMode !== "future"} />
                </div>
                <div className="flex items-end">
                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input type="checkbox" checked={googleDocSkipImages} onChange={(event) => setGoogleDocSkipImages(event.target.checked)} />
                    Skip images (add manually later)
                  </label>
                </div>
              </div>

              <div className="mt-4 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-4 text-xs leading-6 text-blue-900">
                Use a normal Google Doc link only. If the document is private, enable <span className="font-semibold">Anyone with the link can view</span> or use <span className="font-semibold">Publish to web</span>.
              </div>

              <div className="mt-4">
                <button type="button" className="button-secondary" onClick={handlePublishGoogleDoc} disabled={isBusy || selectedSites.length === 0}>{isPublishingGoogleDoc ? `Publishing to ${selectedSites.length} site(s)...` : `Import and publish to ${selectedSites.length || 0} site(s)`}</button>
              </div>
            </section>
          ) : null}

          {workspaceMode === "news" ? (
            <section className="panel px-4 py-4 md:px-5">
              <div className="section-header">
                <div>
                  <p className="eyebrow">News Autopilot</p>
                  <h2 className="mt-1 text-sm font-semibold text-slate-950">Rewrite fresh news into articles</h2>
                </div>
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div>
                  <label className="label">News category</label>
                  <select className="select" value={newsCategory} onChange={(event) => setNewsCategory(event.target.value as (typeof newsCategoryOptions)[number])}>
                    {newsCategoryOptions.map((option) => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">Keyword filter</label>
                  <input className="input" value={newsQuery} onChange={(event) => setNewsQuery(event.target.value)} placeholder="Optional filter" />
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
                  <label className="label">Schedule date / time</label>
                  <input type="datetime-local" className="input" value={newsScheduledAtLocal} onChange={(event) => setNewsScheduledAtLocal(event.target.value)} disabled={newsPublishMode !== "future"} />
                </div>
                <div>
                  <label className="label">AI engine</label>
                  <select className="select" value={aiProvider} onChange={(event) => handleAiProviderChange(event.target.value as AiProvider)}>
                      {aiProviderOptions.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                </div>
                <div>
                  <label className="label">Model ({getAiProviderLabel(aiProvider)})</label>
                  <select className="select" value={aiModel} onChange={(event) => setAiModel(event.target.value)}>
                      {availableAiModels.map((model) => (
                        <option key={model.value} value={model.value}>{model.label}</option>
                      ))}
                    </select>
                </div>
                <div>
                  <label className="label">In-post images</label>
                  <input type="number" className="input" min={0} max={10} value={inPostImageCount} onChange={(event) => setInPostImageCount(Math.max(0, Math.min(10, Number(event.target.value) || 0)))} disabled={newsSkipImages} />
                </div>
                <div className="flex items-end">
                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input type="checkbox" checked={newsSkipImages} onChange={(event) => setNewsSkipImages(event.target.checked)} />
                    Skip images (add manually later)
                  </label>
                </div>
              </div>

              <div className="mt-4">
                <button type="button" className="button-primary" onClick={handleAutoPublishNews} disabled={isBusy || !selectedSiteId}>{isAutoPublishingNews ? "Processing..." : "Run news autopilot"}</button>
              </div>
            </section>
          ) : null}
        </div>

        <div className="space-y-4">
          <section className="panel px-4 py-4">
            <div className="section-header">
              <div>
                <p className="eyebrow">ChatGPT</p>
                <h2 className="mt-1 text-sm font-semibold text-slate-950">Connector handoff</h2>
              </div>
              <span className="badge-info">MCP</span>
            </div>
            <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                Connector URL
              </p>
              <p className="mt-1 break-all font-mono text-xs leading-5 text-slate-700">
                {getMcpConnectorUrl()}
              </p>
            </div>
            <div className="mt-3 grid gap-2">
              <button
                type="button"
                className="button-secondary w-full"
                onClick={handleConnectChatGpt}
              >
                <PlugZap className="h-4 w-4" />
                Connect ChatGPT
                <ExternalLink className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                className="button-primary w-full"
                onClick={handleOpenDraftInChatGpt}
              >
                <MessageSquare className="h-4 w-4" />
                Open Draft In ChatGPT
                <ExternalLink className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                className="button-muted w-full"
                onClick={() =>
                  void copyText(
                    buildChatGptCommand(),
                    "ChatGPT command copied.",
                  )
                }
              >
                <Copy className="h-4 w-4" />
                Copy ChatGPT Command
              </button>
            </div>
            <p className="mt-3 text-xs leading-5 text-slate-500">
              ChatGPT requires the user to approve connector setup and run the
              command from ChatGPT.
            </p>
          </section>

          <section className="panel px-4 py-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="eyebrow">Bulk Targets</p>
                <p className="mt-1 text-sm font-semibold text-slate-950">{selectedSites.length ? `${selectedSites.length} site(s) selected` : "No sites selected"}</p>
              </div>
              {selectedSite?.isDefault ? <span className="badge-info">Default</span> : null}
            </div>
            <p className="mt-2 break-all text-xs leading-5 text-slate-500">{selectedSites.length ? selectedSites.map((site) => site.name).join(", ") : "Select one or more sites to enable publish actions."}</p>
            {selectedSite ? (
              <div className="mt-3 grid gap-2 text-xs text-slate-500">
                <p>User: {selectedSite.username}</p>
                <p>Updated: {new Date(selectedSite.updatedAt).toLocaleString()}</p>
              </div>
            ) : null}
          </section>

          <section className="panel px-4 py-4">
            <div className="section-header">
              <div>
                <p className="eyebrow">Workflow Activity</p>
                <h2 className="mt-1 text-sm font-semibold text-slate-950">Run status</h2>
              </div>
            </div>
            <div className="mt-3 grid gap-3">
              <div className="flex items-center justify-between status-row">
                <span className="text-sm text-slate-700">Draft generation</span>
                <span className={isGeneratingDraft ? "badge-info" : "badge-neutral"}>{isGeneratingDraft ? "Running" : generatedHtml ? "Ready" : "Idle"}</span>
              </div>
              <div className="flex items-center justify-between status-row">
                <span className="text-sm text-slate-700">Draft editing</span>
                <span className={isEditingDraft ? "badge-info" : "badge-neutral"}>{isEditingDraft ? "Running" : editPrompt.trim() ? "Queued" : "Idle"}</span>
              </div>
              <div className="flex items-center justify-between status-row">
                <span className="text-sm text-slate-700">Image generation</span>
                <span className={isGeneratingImage ? "badge-info" : "badge-neutral"}>{isGeneratingImage ? "Running" : generatedImage ? "Ready" : "Idle"}</span>
              </div>
              <div className="flex items-center justify-between status-row">
                <span className="text-sm text-slate-700">Publishing</span>
                <span className={isPublishing || isPublishingGoogleDoc || isAutoPublishingNews ? "badge-info" : "badge-neutral"}>{isPublishing || isPublishingGoogleDoc || isAutoPublishingNews ? "Running" : "Idle"}</span>
              </div>
            </div>
          </section>

          {generatedImage ? (
            <section className="panel px-4 py-4">
              <div className="flex items-center justify-between gap-3">
                <p className="eyebrow">Featured Image</p>
                <span className="badge-success">Generated</span>
              </div>
              <img src={`data:${generatedImage.mimeType};base64,${generatedImage.imageBase64}`} alt={generatedImage.altTextSuggestion} className="mt-3 max-h-72 w-full rounded-lg border border-slate-200 object-cover" />
              <div className="mt-3 space-y-1 text-xs text-slate-500">
                <p>Suggested alt text: {generatedImage.altTextSuggestion}</p>
                <p>Filename: {generatedImage.filenameSuggestion}</p>
              </div>
            </section>
          ) : (
            <section className="panel px-4 py-4">
              <EmptyState title="No featured image yet" description="Generate an image after writing the brief so the visual direction lines up with the draft." />
            </section>
          )}

          {publishResults.map((result) => (
            <ResultSummary
              key={`manual-${result.siteId}`}
              label={`Manual Publish · ${result.siteName}`}
              title={result.ok ? `${result.title} saved to WordPress` : `Failed: ${result.error}`}
              link={result.link}
              status={result.ok ? result.status : "failed"}
              warnings={result.warnings}
            />
          ))}
          {googleDocPublishResults.map((result) => (
            <ResultSummary
              key={`google-doc-${result.siteId}`}
              label={`Google Doc · ${result.siteName}`}
              title={result.ok ? result.title : `Failed: ${result.error}`}
              link={result.link}
              status={result.ok ? result.status : "failed"}
              warnings={result.warnings}
            />
          ))}
          {newsAutoPublishResult ? <ResultSummary label="News Autopilot" title={`${newsAutoPublishResult.published} published / ${newsAutoPublishResult.failed} failed`} /> : null}

          <ArticlePreview html={generatedHtml} links={links} seoProvider={seoProvider} seoPayload={seoPayload} hasGeneratedImage={Boolean(generatedImage)} />
        </div>
      </section>

      {toast ? <StatusToast type={toast.type} message={toast.message} onClose={() => setToast(null)} /> : null}
    </DashboardShell>
  );
}
