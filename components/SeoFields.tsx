"use client";

import type { SeoPayload } from "@/lib/types";

interface SeoFieldsProps {
  value: SeoPayload;
  onChange: (next: SeoPayload) => void;
}

export default function SeoFields({ value, onChange }: SeoFieldsProps) {
  return (
    <div className="panel p-4">
      <h2 className="mb-3 text-base font-semibold text-slate-900">
        SEO Metadata
      </h2>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="md:col-span-2">
          <label className="label">SEO Title</label>
          <input
            className="input"
            value={value.seoTitle}
            onChange={(event) =>
              onChange({ ...value, seoTitle: event.target.value })
            }
          />
        </div>

        <div className="md:col-span-2">
          <label className="label">Meta Description</label>
          <textarea
            className="textarea min-h-24"
            value={value.metaDescription}
            onChange={(event) =>
              onChange({ ...value, metaDescription: event.target.value })
            }
          />
        </div>

        <div className="rounded-lg border border-slate-200 p-3">
          <h3 className="mb-2 font-semibold text-slate-800">OpenGraph</h3>
          <label className="label">OG Title</label>
          <input
            className="input"
            value={value.og.title}
            onChange={(event) =>
              onChange({
                ...value,
                og: { ...value.og, title: event.target.value },
              })
            }
          />
          <label className="label mt-3">OG Description</label>
          <textarea
            className="textarea min-h-20"
            value={value.og.description}
            onChange={(event) =>
              onChange({
                ...value,
                og: { ...value.og, description: event.target.value },
              })
            }
          />
          <label className="label mt-3">OG Image Override URL (optional)</label>
          <input
            className="input"
            placeholder="https://www.buddhikaviraj.com/og-image.jpg"
            value={value.og.imageUrl || ""}
            onChange={(event) =>
              onChange({
                ...value,
                og: { ...value.og, imageUrl: event.target.value },
              })
            }
          />
        </div>

        <div className="rounded-lg border border-slate-200 p-3">
          <h3 className="mb-2 font-semibold text-slate-800">Twitter</h3>
          <label className="label">Twitter Title</label>
          <input
            className="input"
            value={value.twitter.title}
            onChange={(event) =>
              onChange({
                ...value,
                twitter: { ...value.twitter, title: event.target.value },
              })
            }
          />
          <label className="label mt-3">Twitter Description</label>
          <textarea
            className="textarea min-h-20"
            value={value.twitter.description}
            onChange={(event) =>
              onChange({
                ...value,
                twitter: { ...value.twitter, description: event.target.value },
              })
            }
          />
          <label className="label mt-3">
            Twitter Image Override URL (optional)
          </label>
          <input
            className="input"
            placeholder="https://www.buddhikaviraj.com/twitter-image.jpg"
            value={value.twitter.imageUrl || ""}
            onChange={(event) =>
              onChange({
                ...value,
                twitter: { ...value.twitter, imageUrl: event.target.value },
              })
            }
          />
        </div>
      </div>
      <p className="mt-3 text-xs text-slate-500">
        If image override URLs are empty, publish will use the uploaded featured
        image URL when available.
      </p>
    </div>
  );
}
