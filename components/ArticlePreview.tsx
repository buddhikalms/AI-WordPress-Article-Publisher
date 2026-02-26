"use client";

import { useMemo } from "react";
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
  const linkStatus = useMemo(
    () => validateRequiredLinks(html, links),
    [html, links],
  );

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
    <div className="panel p-4">
      <h2 className="mb-3 text-base font-semibold text-slate-900">Preview</h2>

      <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
        <h3 className="mb-2 font-semibold text-slate-800">
          Required Link Validation
        </h3>
        <p className="text-sm text-slate-700">
          Present: {linkStatus.present.length} | Missing:{" "}
          {linkStatus.missing.length} | Duplicated required links:{" "}
          {linkStatus.duplicateRequired.length}
        </p>
        {linkStatus.missing.length > 0 ? (
          <ul className="mt-2 list-disc pl-5 text-sm text-red-700">
            {linkStatus.missing.map((link) => (
              <li key={`${link.url}-${link.anchorText}`}>
                Missing: <code>{link.anchorText}</code> - <code>{link.url}</code>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
        <h3 className="mb-2 font-semibold text-slate-800">
          SEO Payload (What Will Be Sent)
        </h3>
        <pre className="max-h-80 overflow-auto rounded bg-slate-900 p-3 text-xs text-slate-100">
          {JSON.stringify(seoPreview, null, 2)}
        </pre>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-3">
        <h3 className="mb-2 font-semibold text-slate-800">Generated HTML</h3>
        {html ? (
          <article
            className="max-w-none text-sm text-slate-800 [&_h2]:mt-5 [&_h2]:text-lg [&_h2]:font-semibold [&_h3]:mt-4 [&_h3]:text-base [&_h3]:font-semibold [&_li]:ml-5 [&_li]:list-disc [&_p]:my-2"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        ) : (
          <p className="text-sm text-slate-500">No draft generated yet.</p>
        )}
      </div>
    </div>
  );
}
