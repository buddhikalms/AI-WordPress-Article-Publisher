"use client";

import { useMemo, useState } from "react";
import ArticlePreview from "@/components/ArticlePreview";
import LinkTable from "@/components/LinkTable";
import SeoFields from "@/components/SeoFields";
import StatusToast from "@/components/StatusToast";
import type { HyperlinkInput, SEOProvider, SeoPayload } from "@/lib/types";

type ToastState = {
  type: "success" | "error" | "info";
  message: string;
};

type GeneratedImageState = {
  imageBase64: string;
  mimeType: string;
  filenameSuggestion: string;
  altTextSuggestion: string;
};

type PublishResultState = {
  postId: number;
  link: string;
  status: string;
  seoUpdate: {
    ok: boolean;
    provider: SEOProvider;
    details: string;
    error?: unknown;
  };
};

const toneOptions = [
  "Professional",
  "Conversational",
  "Authoritative",
  "Friendly",
  "Technical",
];

const initialSeoPayload: SeoPayload = {
  seoTitle: "",
  metaDescription: "",
  focusKeyword: "",
  canonicalUrl: "",
  og: {
    title: "",
    description: "",
    imageUrl: "",
  },
  twitter: {
    title: "",
    description: "",
    imageUrl: "",
  },
};

const initialLink: HyperlinkInput = {
  url: "",
  anchorText: "",
  required: true,
};

const getApiError = async (response: Response) => {
  const fallback = `Request failed with ${response.status}`;
  try {
    const body = (await response.json()) as {
      error?: string;
      details?: unknown;
      missing?: Array<{ url: string; anchorText: string }>;
      duplicates?: Array<{ url: string; anchorText: string }>;
    };
    if (body.error) {
      const missingSummary =
        body.missing && body.missing.length > 0
          ? ` Missing required links: ${body.missing
              .map((item) => `"${item.anchorText}" (${item.url})`)
              .join(", ")}.`
          : "";
      const duplicateSummary =
        body.duplicates && body.duplicates.length > 0
          ? ` Duplicated required links: ${body.duplicates
              .map((item) => `"${item.anchorText}" (${item.url})`)
              .join(", ")}.`
          : "";
      return `${body.error}${missingSummary}${duplicateSummary}`;
    }
    return fallback;
  } catch {
    return fallback;
  }
};

const normalizeLinks = (links: HyperlinkInput[]) => {
  const rows = links.filter(
    (link) => link.url.trim().length > 0 || link.anchorText.trim().length > 0,
  );
  for (const row of rows) {
    if (!row.url.trim() || !row.anchorText.trim()) {
      throw new Error(
        "Each hyperlink row must include both URL and anchor text.",
      );
    }
  }
  return rows.map((row) => ({
    url: row.url.trim(),
    anchorText: row.anchorText.trim(),
    required: row.required,
  }));
};

const parseKeywords = (keywords: string) =>
  keywords
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

export default function HomePage() {
  const [title, setTitle] = useState("");
  const [brief, setBrief] = useState("");
  const [keywords, setKeywords] = useState("");
  const [tone, setTone] = useState("Professional");
  const [wordCount, setWordCount] = useState<number>(1200);
  const [seoProvider, setSeoProvider] = useState<SEOProvider>("None");
  const [seoPayload, setSeoPayload] = useState<SeoPayload>(initialSeoPayload);
  const [links, setLinks] = useState<HyperlinkInput[]>([initialLink]);

  const [generatedHtml, setGeneratedHtml] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [suggestedTags, setSuggestedTags] = useState<string[]>([]);
  const [generatedImage, setGeneratedImage] =
    useState<GeneratedImageState | null>(null);
  const [publishResult, setPublishResult] = useState<PublishResultState | null>(
    null,
  );
  const [toast, setToast] = useState<ToastState | null>(null);

  const [isGeneratingDraft, setIsGeneratingDraft] = useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);

  const keywordsCount = useMemo(
    () => parseKeywords(keywords).length,
    [keywords],
  );

  const handleGenerateDraft = async () => {
    try {
      if (!title.trim() || !brief.trim()) {
        throw new Error("Title and Topic/Brief are required.");
      }
      if (!seoPayload.focusKeyword.trim()) {
        throw new Error("Focus keyword is required.");
      }
      const normalizedLinks = normalizeLinks(links);
      setIsGeneratingDraft(true);
      setPublishResult(null);

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
          links: normalizedLinks,
        }),
      });

      if (!response.ok) {
        throw new Error(await getApiError(response));
      }

      const data = (await response.json()) as {
        html: string;
        meta: {
          title: string;
          excerpt: string;
          suggestedTags: string[];
          seo: SeoPayload;
        };
      };

      setGeneratedHtml(data.html);
      setExcerpt(data.meta.excerpt);
      setSuggestedTags(data.meta.suggestedTags || []);
      setSeoPayload((current) => ({
        ...current,
        ...data.meta.seo,
        focusKeyword: data.meta.seo.focusKeyword || current.focusKeyword,
        canonicalUrl: current.canonicalUrl || data.meta.seo.canonicalUrl || "",
        og: {
          ...current.og,
          ...data.meta.seo.og,
        },
        twitter: {
          ...current.twitter,
          ...data.meta.seo.twitter,
        },
      }));
      setToast({
        type: "success",
        message: "Draft HTML generated successfully.",
      });
    } catch (error) {
      setToast({
        type: "error",
        message:
          error instanceof Error ? error.message : "Failed to generate draft.",
      });
    } finally {
      setIsGeneratingDraft(false);
    }
  };

  const handleGenerateImage = async () => {
    try {
      if (!title.trim() || !brief.trim()) {
        throw new Error(
          "Title and Topic/Brief are required before image generation.",
        );
      }

      setIsGeneratingImage(true);
      const response = await fetch("/api/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          brief: brief.trim(),
        }),
      });

      if (!response.ok) {
        throw new Error(await getApiError(response));
      }

      const data = (await response.json()) as GeneratedImageState;
      setGeneratedImage(data);
      setToast({
        type: "success",
        message: "Featured image generated successfully.",
      });
    } catch (error) {
      setToast({
        type: "error",
        message:
          error instanceof Error ? error.message : "Failed to generate image.",
      });
    } finally {
      setIsGeneratingImage(false);
    }
  };

  const handlePublishDraft = async () => {
    try {
      if (!generatedHtml.trim()) {
        throw new Error("Generate a draft before publishing.");
      }
      if (!excerpt.trim()) {
        throw new Error(
          "Excerpt is required. Generate a draft or provide excerpt.",
        );
      }

      setIsPublishing(true);
      const response = await fetch("/api/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          html: generatedHtml,
          excerpt: excerpt.trim(),
          status: "draft",
          featuredImageBase64: generatedImage?.imageBase64,
          featuredImageMime: generatedImage?.mimeType,
          seoProvider,
          seoPayload,
        }),
      });

      if (!response.ok) {
        throw new Error(await getApiError(response));
      }

      const data = (await response.json()) as PublishResultState;
      setPublishResult(data);
      setToast({
        type: data.seoUpdate.ok ? "success" : "info",
        message: data.seoUpdate.ok
          ? `Post #${data.postId} published as draft successfully.`
          : `Post #${data.postId} published, but SEO update needs attention.`,
      });
    } catch (error) {
      setToast({
        type: "error",
        message:
          error instanceof Error ? error.message : "Failed to publish draft.",
      });
    } finally {
      setIsPublishing(false);
    }
  };

  return (
    <main className="mx-auto max-w-7xl px-4 py-6 md:px-6">
      <h1 className="mb-2 text-2xl font-bold text-slate-900">
        AI WordPress Article Publisher
      </h1>
      <p className="mb-6 text-sm text-slate-600">
        Generate WordPress-ready HTML + featured image, enforce required links,
        then publish through secure API routes with AIOSEO or Yoast metadata.
      </p>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="space-y-6">
          <div className="panel p-4">
            <h2 className="mb-3 text-base font-semibold text-slate-900">
              Article Inputs
            </h2>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className="label">Title</label>
                <input
                  className="input"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="Article title"
                />
              </div>

              <div className="md:col-span-2">
                <label className="label">Topic / Brief</label>
                <textarea
                  className="textarea min-h-32"
                  value={brief}
                  onChange={(event) => setBrief(event.target.value)}
                  placeholder="Describe what the article should cover..."
                />
              </div>

              <div className="md:col-span-2">
                <label className="label">Keywords (comma-separated)</label>
                <input
                  className="input"
                  value={keywords}
                  onChange={(event) => setKeywords(event.target.value)}
                  placeholder="keyword one, keyword two, keyword three"
                />
                <p className="mt-1 text-xs text-slate-500">
                  Parsed keywords: {keywordsCount}
                </p>
              </div>

              <div>
                <label className="label">Focus Keyword</label>
                <input
                  className="input"
                  value={seoPayload.focusKeyword}
                  onChange={(event) =>
                    setSeoPayload({
                      ...seoPayload,
                      focusKeyword: event.target.value,
                    })
                  }
                  placeholder="Main keyphrase"
                />
              </div>

              <div>
                <label className="label">Tone</label>
                <select
                  className="select"
                  value={tone}
                  onChange={(event) => setTone(event.target.value)}
                >
                  {toneOptions.map((toneOption) => (
                    <option key={toneOption} value={toneOption}>
                      {toneOption}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label">Word Count</label>
                <input
                  type="number"
                  className="input"
                  min={300}
                  max={5000}
                  value={wordCount}
                  onChange={(event) =>
                    setWordCount(Number(event.target.value) || 1200)
                  }
                />
              </div>

              <div>
                <label className="label">Canonical URL (optional)</label>
                <input
                  className="input"
                  placeholder="https://www.buddhikaviraj.com/canonical-page"
                  value={seoPayload.canonicalUrl || ""}
                  onChange={(event) =>
                    setSeoPayload({
                      ...seoPayload,
                      canonicalUrl: event.target.value,
                    })
                  }
                />
              </div>

              <div className="md:col-span-2">
                <label className="label">SEO Provider</label>
                <div className="flex flex-wrap gap-4">
                  {(["AIOSEO", "Yoast", "None"] as const).map((provider) => (
                    <label
                      key={provider}
                      className="inline-flex items-center gap-2 text-sm text-slate-700"
                    >
                      <input
                        type="radio"
                        checked={seoProvider === provider}
                        onChange={() => setSeoProvider(provider)}
                      />
                      {provider}
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-3">
              <button
                type="button"
                className="button-primary"
                onClick={handleGenerateDraft}
                disabled={
                  isGeneratingDraft || isGeneratingImage || isPublishing
                }
              >
                {isGeneratingDraft ? "Generating..." : "Generate Draft"}
              </button>
              <button
                type="button"
                className="button-secondary"
                onClick={handleGenerateImage}
                disabled={
                  isGeneratingImage || isGeneratingDraft || isPublishing
                }
              >
                {isGeneratingImage ? "Generating..." : "Generate Image"}
              </button>
              <button
                type="button"
                className="button-muted"
                onClick={handlePublishDraft}
                disabled={
                  isPublishing || isGeneratingDraft || isGeneratingImage
                }
              >
                {isPublishing ? "Publishing..." : "Publish as Draft"}
              </button>
            </div>

            {excerpt ? (
              <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Excerpt
                </p>
                <p className="mt-1 text-sm text-slate-700">{excerpt}</p>
              </div>
            ) : null}

            {suggestedTags.length > 0 ? (
              <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Suggested Tags
                </p>
                <p className="mt-1 text-sm text-slate-700">
                  {suggestedTags.join(", ")}
                </p>
              </div>
            ) : null}

            {generatedImage ? (
              <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Generated Featured Image
                </p>
                <img
                  src={`data:${generatedImage.mimeType};base64,${generatedImage.imageBase64}`}
                  alt={generatedImage.altTextSuggestion}
                  className="mt-2 max-h-56 rounded-lg border border-slate-200 object-cover"
                />
                <p className="mt-2 text-xs text-slate-600">
                  {generatedImage.filenameSuggestion} | alt:{" "}
                  {generatedImage.altTextSuggestion}
                </p>
              </div>
            ) : null}

            {publishResult ? (
              <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
                <p className="font-semibold text-slate-900">
                  WordPress post created: #{publishResult.postId}
                </p>
                <p className="mt-1 text-slate-700">
                  Status: <code>{publishResult.status}</code>
                </p>
                <p className="mt-1 break-all text-slate-700">
                  Link:{" "}
                  <a
                    className="text-blue-700 underline"
                    href={publishResult.link}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {publishResult.link}
                  </a>
                </p>
                <p className="mt-1 text-slate-700">
                  SEO update ({publishResult.seoUpdate.provider}):{" "}
                  {publishResult.seoUpdate.details}
                </p>
              </div>
            ) : null}
          </div>

          <LinkTable links={links} onChange={setLinks} />
          <SeoFields value={seoPayload} onChange={setSeoPayload} />
        </section>

        <section>
          <ArticlePreview
            html={generatedHtml}
            links={links}
            seoProvider={seoProvider}
            seoPayload={seoPayload}
            hasGeneratedImage={Boolean(generatedImage)}
          />
        </section>
      </div>

      {toast ? (
        <StatusToast
          type={toast.type}
          message={toast.message}
          onClose={() => setToast(null)}
        />
      ) : null}
    </main>
  );
}
