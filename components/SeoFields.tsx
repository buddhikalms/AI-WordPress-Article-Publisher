"use client";

import type { SeoPayload } from "@/lib/types";

interface SeoFieldsProps {
  value: SeoPayload;
  onChange: (next: SeoPayload) => void;
}

export default function SeoFields({ value, onChange }: SeoFieldsProps) {
  return (
    <section className="panel px-4 py-4 md:px-5">
      <div className="section-header">
        <div>
          <p className="eyebrow">SEO Metadata</p>
          <h2 className="mt-1 text-sm font-semibold text-slate-950">Search and social payload</h2>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            Keep the payload tight and channel-specific so the publish step mirrors a premium CMS workflow.
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)_minmax(0,0.9fr)]">
        <div className="panel-muted px-4 py-4">
          <p className="eyebrow">Core</p>
          <div className="mt-3 space-y-4">
            <div>
              <label className="label">SEO title</label>
              <input
                className="input"
                value={value.seoTitle}
                onChange={(event) => onChange({ ...value, seoTitle: event.target.value })}
              />
              <p className="helper">Use a clean title variation tuned for click-through rate.</p>
            </div>

            <div>
              <label className="label">Meta description</label>
              <textarea
                className="textarea min-h-[120px]"
                value={value.metaDescription}
                onChange={(event) =>
                  onChange({ ...value, metaDescription: event.target.value })
                }
              />
              <p className="helper">Aim for a concise summary that supports the focus keyword naturally.</p>
            </div>
          </div>
        </div>

        <div className="panel-muted px-4 py-4">
          <p className="eyebrow">OpenGraph</p>
          <div className="mt-3 space-y-4">
            <div>
              <label className="label">OG title</label>
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
            </div>

            <div>
              <label className="label">OG description</label>
              <textarea
                className="textarea min-h-[100px]"
                value={value.og.description}
                onChange={(event) =>
                  onChange({
                    ...value,
                    og: { ...value.og, description: event.target.value },
                  })
                }
              />
            </div>

            <div>
              <label className="label">OG image override</label>
              <input
                className="input"
                placeholder="https://example.com/og-image.jpg"
                value={value.og.imageUrl || ""}
                onChange={(event) =>
                  onChange({
                    ...value,
                    og: { ...value.og, imageUrl: event.target.value },
                  })
                }
              />
              <p className="helper">Leave empty to reuse the generated featured image after upload.</p>
            </div>
          </div>
        </div>

        <div className="panel-muted px-4 py-4">
          <p className="eyebrow">Twitter</p>
          <div className="mt-3 space-y-4">
            <div>
              <label className="label">Twitter title</label>
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
            </div>

            <div>
              <label className="label">Twitter description</label>
              <textarea
                className="textarea min-h-[100px]"
                value={value.twitter.description}
                onChange={(event) =>
                  onChange({
                    ...value,
                    twitter: { ...value.twitter, description: event.target.value },
                  })
                }
              />
            </div>

            <div>
              <label className="label">Twitter image override</label>
              <input
                className="input"
                placeholder="https://example.com/twitter-image.jpg"
                value={value.twitter.imageUrl || ""}
                onChange={(event) =>
                  onChange({
                    ...value,
                    twitter: { ...value.twitter, imageUrl: event.target.value },
                  })
                }
              />
              <p className="helper">Use an override only when you need a social-specific asset.</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
