"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell, ChevronDown, Plus, Search } from "lucide-react";
import { CommandPalette } from "@/components/ui/CommandPalette";
import { ICON_STROKE } from "@/components/ui/icons";

export type BellItem = { key: string; title: string; reason: React.ReactNode; href: string };

function useDismiss(open: boolean, setOpen: (v: boolean) => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, setOpen]);
  return ref;
}

function NewMenu() {
  const [open, setOpen] = useState(false);
  const ref = useDismiss(open, setOpen);
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="inline-flex h-12 w-new-button items-center gap-3 rounded-control border border-brand bg-surface px-5 text-meta text-brand hover:text-brand-hover"
      >
        <Plus size={22} strokeWidth={ICON_STROKE} aria-hidden />
        <span>New</span>
        <ChevronDown size={22} strokeWidth={ICON_STROKE} className="ml-auto" aria-hidden />
      </button>
      {open && (
        <div className="absolute right-0 top-full z-40 mt-2 w-60 rounded-container border border-border bg-surface py-2" role="menu">
          {[
            { label: "Ask a question", href: "?ask=1" },
            { label: "Propose an idea", href: "/ideas/new" },
          ].map((item) => (
            <Link key={item.label} href={item.href} role="menuitem" onClick={() => setOpen(false)} className="block px-4 py-3 text-meta text-text hover:bg-neutral-soft">
              {item.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function BellMenu({ items }: { items: BellItem[] }) {
  const [open, setOpen] = useState(false);
  const ref = useDismiss(open, setOpen);
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-label={items.length ? `${items.length} things need you` : "Nothing needs you right now"}
        aria-expanded={open}
        className="relative flex h-12 w-12 items-center justify-center text-text hover:text-brand"
      >
        <Bell size={28} strokeWidth={ICON_STROKE} aria-hidden />
        {items.length > 0 && <span className="absolute right-2 top-1 h-3 w-3 rounded-full bg-brand" aria-hidden />}
      </button>
      {open && (
        <div className="absolute right-0 top-full z-40 mt-2 w-96 rounded-container border border-border bg-surface px-5 py-2">
          {items.length === 0 ? (
            <p className="py-3 text-meta text-text-muted">Nothing needs you right now</p>
          ) : (
            <div className="divide-y divide-border">
              {items.map((item) => (
                <Link key={item.key} href={item.href} onClick={() => setOpen(false)} className="block py-3">
                  <span className="block text-meta font-medium text-text">{item.title}</span>
                  <span className="block text-label text-text-muted">{item.reason}</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function TopBar({ bellItems }: { bellItems: BellItem[] }) {
  const [paletteOpen, setPaletteOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen(true);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  return (
    <header className="sticky top-0 z-30 flex h-topbar items-center border-b border-border bg-surface pl-search-inset pr-9">
      <div className="w-full max-w-search">
        <button
          type="button"
          onClick={() => setPaletteOpen(true)}
          className="flex h-12 w-full max-w-search items-center gap-4 rounded-control border border-border bg-surface px-5 text-left text-meta text-text-muted hover:border-text-muted"
        >
          <Search size={22} strokeWidth={ICON_STROKE} aria-hidden />
          <span className="flex-1">Search Spine...</span>
          <span className="flex gap-1" aria-hidden>
            <kbd className="rounded-sm bg-neutral-soft px-2 font-sans text-label text-text-muted">⌘</kbd>
            <kbd className="rounded-sm bg-neutral-soft px-2 font-sans text-label text-text-muted">K</kbd>
          </span>
        </button>
      </div>
      <div className="ml-auto flex items-center gap-11 pl-8">
        <NewMenu />
        <BellMenu items={bellItems} />
      </div>
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </header>
  );
}
