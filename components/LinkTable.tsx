"use client";

import type { HyperlinkInput } from "@/lib/types";

interface LinkTableProps {
  links: HyperlinkInput[];
  onChange: (next: HyperlinkInput[]) => void;
}

const createEmptyLink = (): HyperlinkInput => ({
  url: "",
  anchorText: "",
  required: false,
});

export default function LinkTable({ links, onChange }: LinkTableProps) {
  const updateRow = (index: number, patch: Partial<HyperlinkInput>) => {
    const next = [...links];
    next[index] = {
      ...next[index],
      ...patch,
    };
    onChange(next);
  };

  const addRow = () => onChange([...links, createEmptyLink()]);
  const removeRow = (index: number) =>
    onChange(links.filter((_, rowIndex) => rowIndex !== index));

  return (
    <div className="panel p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-base font-semibold text-slate-900">Hyperlinks</h2>
        <button type="button" className="button-muted" onClick={addRow}>
          Add Link
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-slate-600">
              <th className="px-2 py-2 font-semibold">URL</th>
              <th className="px-2 py-2 font-semibold">Anchor Text</th>
              <th className="px-2 py-2 font-semibold">Required</th>
              <th className="px-2 py-2 font-semibold">Action</th>
            </tr>
          </thead>
          <tbody>
            {links.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-2 py-4 text-slate-500">
                  No links added yet.
                </td>
              </tr>
            ) : (
              links.map((link, index) => (
                <tr
                  key={`${index}-${link.url}`}
                  className="border-b border-slate-100"
                >
                  <td className="px-2 py-2 align-top">
                    <input
                      className="input"
                      placeholder="https://www.buddhikaviraj.com/page"
                      value={link.url}
                      onChange={(event) =>
                        updateRow(index, { url: event.target.value })
                      }
                    />
                  </td>
                  <td className="px-2 py-2 align-top">
                    <input
                      className="input"
                      placeholder="Anchor text"
                      value={link.anchorText}
                      onChange={(event) =>
                        updateRow(index, { anchorText: event.target.value })
                      }
                    />
                  </td>
                  <td className="px-2 py-2 align-top">
                    <label className="inline-flex items-center gap-2 text-slate-700">
                      <input
                        type="checkbox"
                        checked={link.required}
                        onChange={(event) =>
                          updateRow(index, { required: event.target.checked })
                        }
                      />
                      Must include
                    </label>
                  </td>
                  <td className="px-2 py-2 align-top">
                    <button
                      type="button"
                      className="button-muted"
                      onClick={() => removeRow(index)}
                      disabled={links.length === 1}
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
