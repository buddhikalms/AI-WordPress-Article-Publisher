"use client";

import { useMemo } from "react";
import EmptyState from "@/components/EmptyState";
import { validateRequiredLinks } from "@/lib/link-validation";
import { getProviderPayloadPreview } from "@/lib/seo";
import type { HyperlinkInput, SEOProvider, SeoPayload } from "@/lib/types";

interface ArticlePreviewProps {
  html: string;
  links: HyperlinkInput[];
  seoProvider: SEOProvider;
  seoPayload: SeoPayload;
  hasGeneratedImage: boolean;
}

export default function ArticlePreview({
  html,
  links,
  seoProvider,
  seoPayload,
  hasGeneratedImage,
}: ArticlePreviewProps) {
  const linkStatus = useMemo(() => validateRequiredLinks(html, links), [html, links]);

  const seoPreview = useMemo(
    () =>
      getProviderPayloadPreview(
        seoProvider,
        seoPayload,
        hasGeneratedImage ? "[featured image URL after upload]" : undefined,
      ),
    [seoProvider, seoPayload, hasGeneratedImage],
  );

  return (
    <section className="panel px-4 py-4 md:px-5">
      <div className="section-header">
        <div>
          <p className="eyebrow">Preview</p>
          <h2 className="mt-1 text-sm font-semibold text-slate-950">Publishing QA</h2>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            Review required links, the SEO payload, and the rendered draft before pushing to WordPress.
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <div className="panel-muted px-4 py-4">
          <p className="eyebrow">Required Links</p>
          <div className="mt-3 grid gap-3">
            <div className="rounded-2xl border border-slate-200 bg-white px-3 py-3">
              <p className="text-[11px] uppercase tracking-[0.14em] text-slate-500">Present</p>
              <p className="mt-1 text-lg font-semibold text-slate-950">{linkStatus.present.length}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white px-3 py-3">
              <p className="text-[11px] uppercase tracking-[0.14em] text-slate-500">Missing</p>
              <p className="mt-1 text-lg font-semibold text-slate-950">{linkStatus.missing.length}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white px-3 py-3">
              <p className="text-[11px] uppercase tracking-[0.14em] text-slate-500">Duplicates</p>
              <p className="mt-1 text-lg font-semibold text-slate-950">
                {linkStatus.duplicateRequired.length}
              </p>
            </div>
          </div>
          {linkStatus.missing.length > 0 ? (
            <div className="mt-4 space-y-2">
              {linkStatus.missing.map((link) => (
                <div
                  key={`${link.url}-${link.anchorText}`}
                  className="rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700"
                >
                  Missing <span className="font-semibold">{link.anchorText}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-3 text-xs text-emerald-700">
              All required links are present in the generated draft.
            </div>
          )}
        </div>

        <div className="panel-muted px-4 py-4 lg:col-span-2">
          <div className="flex items-center justify-between gap-3">
            <p className="eyebrow">Payload Preview</p>
            <span className="badge-neutral">{seoProvider}</span>
          </div>
          <pre className="mt-3 max-h-[320px] overflow-auto rounded-2xl bg-slate-950 p-4 text-xs leading-6 text-slate-100">
            {JSON.stringify(seoPreview, null, 2)}
          </pre>
        </div>
      </div>

      <div className="mt-4 panel-muted px-4 py-4">
        <div className="flex items-center justify-between gap-3">
          <p className="eyebrow">Rendered Draft</p>
          {html ? <span className="badge-success">Ready</span> : <span className="badge-neutral">Waiting</span>}
        </div>
        {html ? (
          <article
            className="mt-4 max-w-none rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm leading-7 text-slate-700 [&_h2]:mt-6 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-slate-950 [&_h3]:mt-5 [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:text-slate-950 [&_li]:ml-5 [&_li]:list-disc [&_p]:my-3"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        ) : (
          <div className="mt-4">
            <EmptyState
              title="No draft generated yet"
              description="Generate a draft in Manual Studio to review the final article output here."
            />
          </div>
        )}
      </div>
    </section>
  );
}
