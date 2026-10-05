"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { cx } from "@/lib/cx";
import { Modal } from "./Modal";
import { ICON_STROKE } from "./icons";

export type PaletteItem = { id: string; label: string; detail?: string; href: string };
export type PaletteResults = { questions: PaletteItem[]; projects: PaletteItem[]; people: PaletteItem[] };

const ACTIONS: PaletteItem[] = [
  { id: "action-ask", label: "Ask a question", href: "?ask=1" },
  { id: "action-propose", label: "Propose an idea", href: "/ideas/new" },
];

const EMPTY: PaletteResults = { questions: [], projects: [], people: [] };

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PaletteResults>(EMPTY);
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setResults(EMPTY);
      return;
    }
    const q = query.trim();
    if (!q) {
      setResults(EMPTY);
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(q)}`, { signal: ctrl.signal })
        .then((r) => (r.ok ? r.json() : EMPTY))
        .then((data: PaletteResults) => setResults(data))
        .catch(() => {});
    }, 120);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [open, query]);

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const actions = ACTIONS.filter((a) => !q || a.label.toLowerCase().includes(q));
    return [
      { name: "Questions", items: results.questions },
      { name: "Projects", items: results.projects },
      { name: "People", items: results.people },
      { name: "Actions", items: actions },
    ].filter((g) => g.items.length > 0);
  }, [query, results]);

  const flat = groups.flatMap((g) => g.items);

  useEffect(() => setActive(0), [query, results]);

  const go = useCallback(
    (item: PaletteItem | undefined) => {
      if (!item) return;
      onClose();
      router.push(item.href);
    },
    [onClose, router],
  );

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(flat.length - 1, a + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(0, a - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      go(flat[active]);
    }
  };

  let index = -1;
  return (
    <Modal open={open} onClose={onClose} bare title="Search Spine">
      <div className="relative border-b border-border">
        <Search size={18} strokeWidth={ICON_STROKE} className="pointer-events-none absolute left-6 top-1/2 -translate-y-1/2 text-text-muted" aria-hidden />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Search questions, projects and people..."
          className="h-16 w-full rounded-container bg-surface pl-16 pr-6 text-meta text-text placeholder:text-text-muted focus:outline-none"
          role="combobox"
          aria-expanded="true"
          aria-controls="palette-results"
        />
      </div>
      <div id="palette-results" role="listbox" className="max-h-96 overflow-y-auto px-3 py-3">
        {groups.length === 0 && <p className="px-3 py-3 text-meta text-text-muted">No results.</p>}
        {groups.map((g) => (
          <div key={g.name} className="mb-2">
            <p className="px-3 py-2 text-label font-medium text-text-muted">{g.name}</p>
            {g.items.map((item) => {
              index += 1;
              const i = index;
              return (
                <button
                  key={item.id}
                  type="button"
                  role="option"
                  aria-selected={i === active}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => go(item)}
                  className={cx("flex w-full items-baseline gap-3 rounded-control px-3 py-2 text-left", i === active && "bg-brand-soft")}
                >
                  <span className={cx("text-meta", i === active ? "text-brand" : "text-text")}>{item.label}</span>
                  {item.detail && <span className="text-label text-text-muted">{item.detail}</span>}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </Modal>
  );
}
