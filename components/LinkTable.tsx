"use client";

import { useEffect, useMemo, useState } from "react";
import EmptyState from "@/components/EmptyState";
import PaginationControls from "@/components/PaginationControls";
import type { HyperlinkInput } from "@/lib/types";

interface LinkTableProps {
  links: HyperlinkInput[];
  onChange: (next: HyperlinkInput[]) => void;
}

const PAGE_SIZE = 5;

const createEmptyLink = (): HyperlinkInput => ({
  url: "",
  anchorText: "",
  required: false,
  followType: "dofollow",
});

export default function LinkTable({ links, onChange }: LinkTableProps) {
  const [search, setSearch] = useState("");
  const [followFilter, setFollowFilter] = useState<"all" | HyperlinkInput["followType"]>("all");
  const [page, setPage] = useState(1);

  const filteredIndexes = useMemo(
    () =>
      links
        .map((link, index) => ({ link, index }))
        .filter(({ link }) => {
          const matchesSearch = `${link.url} ${link.anchorText}`
            .toLowerCase()
            .includes(search.toLowerCase());
          const matchesFilter = followFilter === "all" || link.followType === followFilter;
          return matchesSearch && matchesFilter;
        }),
    [followFilter, links, search],
  );

  const totalPages = Math.max(1, Math.ceil(filteredIndexes.length / PAGE_SIZE));

  useEffect(() => {
    setPage((current) => Math.min(current, totalPages));
  }, [totalPages]);

  useEffect(() => {
    setPage(1);
  }, [followFilter, search]);

  const pagedRows = filteredIndexes.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const updateRow = (index: number, patch: Partial<HyperlinkInput>) => {
    const next = [...links];
    next[index] = {
      ...next[index],
      ...patch,
    };
    onChange(next);
  };

  const addRow = () => {
    onChange([...links, createEmptyLink()]);
    setPage(Math.max(1, Math.ceil((links.length + 1) / PAGE_SIZE)));
  };

  const removeRow = (index: number) =>
    onChange(links.filter((_, rowIndex) => rowIndex !== index));

  return (
    <section className="panel overflow-hidden">
      <div className="px-4 py-4 md:px-5">
        <div className="section-header">
          <div>
            <p className="eyebrow">Link Rules</p>
            <h2 className="mt-1 text-sm font-semibold text-slate-950">Hyperlink table</h2>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              Manage outbound links, required anchors, and follow rules in one compact table.
            </p>
          </div>
          <button type="button" className="button-primary" onClick={addRow}>
            Add link
          </button>
        </div>
      </div>

      <div className="table-toolbar">
        <div className="flex flex-1 flex-col gap-3 md:flex-row">
          <input
            className="input md:max-w-xs"
            placeholder="Search URL or anchor text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <select
            className="select md:max-w-[180px]"
            value={followFilter}
            onChange={(event) =>
              setFollowFilter(event.target.value as "all" | HyperlinkInput["followType"])
            }
          >
            <option value="all">All follow states</option>
            <option value="dofollow">Do follow</option>
            <option value="nofollow">No follow</option>
          </select>
        </div>
        <p className="text-xs text-slate-500">
          All published links open in a new tab with your selected follow rule.
        </p>
      </div>

      {links.length === 0 ? (
        <div className="px-4 pb-4 md:px-5">
          <EmptyState
            title="No links added yet"
            description="Add one or more anchor rules to make the generated article more structured and commercially useful."
            action={
              <button type="button" className="button-muted" onClick={addRow}>
                Add first link
              </button>
            }
          />
        </div>
      ) : filteredIndexes.length === 0 ? (
        <div className="px-4 pb-4 md:px-5">
          <EmptyState
            title="No rows match this filter"
            description="Try a broader search or switch the follow filter to view more link rows."
          />
        </div>
      ) : (
        <>
          <div className="table-scroll">
            <table className="table">
              <thead>
                <tr>
                  <th>URL</th>
                  <th>Anchor Text</th>
                  <th>Follow</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {pagedRows.map(({ link, index }) => (
                  <tr key={`${index}-${link.url}-${link.anchorText}`}>
                    <td className="min-w-[260px]">
                      <div className="space-y-1">
                        <input
                          className="input"
                          placeholder="https://client-site.com/resource"
                          value={link.url}
                          onChange={(event) => updateRow(index, { url: event.target.value })}
                        />
                        <p className="text-xs text-slate-500">Use full URLs for reliable publish behavior.</p>
                      </div>
                    </td>
                    <td className="min-w-[220px]">
                      <div className="space-y-1">
                        <input
                          className="input"
                          placeholder="Anchor text"
                          value={link.anchorText}
                          onChange={(event) =>
                            updateRow(index, { anchorText: event.target.value })
                          }
                        />
                        <p className="text-xs text-slate-500">This text must appear in the final article.</p>
                      </div>
                    </td>
                    <td>
                      <div className="space-y-2">
                        <select
                          className="select min-w-[140px]"
                          value={link.followType}
                          onChange={(event) =>
                            updateRow(index, {
                              followType: event.target.value as HyperlinkInput["followType"],
                            })
                          }
                        >
                          <option value="dofollow">Do follow</option>
                          <option value="nofollow">No follow</option>
                        </select>
                        <span
                          className={
                            link.followType === "dofollow" ? "badge-success" : "badge-warning"
                          }
                        >
                          {link.followType}
                        </span>
                      </div>
                    </td>
                    <td>
                      <div className="space-y-2">
                        <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                          <input
                            type="checkbox"
                            checked={link.required}
                            onChange={(event) =>
                              updateRow(index, { required: event.target.checked })
                            }
                          />
                          Required
                        </label>
                        <span className={link.required ? "badge-info" : "badge-neutral"}>
                          {link.required ? "Must include" : "Optional"}
                        </span>
                      </div>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="button-danger"
                        onClick={() => removeRow(index)}
                        disabled={links.length === 1}
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <PaginationControls
            page={page}
            totalPages={totalPages}
            onPageChange={setPage}
            label="Links"
          />
        </>
      )}
    </section>
  );
}
