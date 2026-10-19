"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell, Menu, Plus, Search } from "lucide-react";
import { cx } from "@/lib/cx";
import { CommandPalette } from "@/components/ui/CommandPalette";
import { markUpdatesRead } from "@/server/notify/actions";
import { ICON_STROKE } from "@/components/ui/icons";
import { Logo } from "./Logo";

export type BellItem = { key: string; title: string; reason: React.ReactNode; href: string };
export type UpdateItem = { id: string; title: string; body: string; href: string; when: string; unread: boolean };

function useDismiss(open: boolean, setOpen: (v: boolean) => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, setOpen]);
  return ref;
}

const NEW_ITEMS = [
  { label: "Ask a question", detail: "A Champion answers privately", href: "?ask=1" },
  { label: "Propose an idea", detail: "Describe it, Spine drafts the rest", href: "/ideas/new" },
  { label: "Share a discovery", detail: "Something that worked for you", href: "/discover?share=1" },
];

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
        className="inline-flex h-8 items-center gap-1.5 rounded-control border border-border-strong bg-surface px-2.5 text-label font-medium text-text hover:bg-subtle"
      >
        <Plus size={15} strokeWidth={ICON_STROKE} aria-hidden />
        <span>New</span>
      </button>
      {open && (
        <div className="absolute right-0 top-full z-40 mt-1.5 w-72 rounded-control border border-border bg-surface py-1 shadow-popover" role="menu">
          {NEW_ITEMS.map((item) => (
            <Link key={item.label} href={item.href} role="menuitem" onClick={() => setOpen(false)} className="block px-3 py-2 hover:bg-subtle">
              <span className="block text-meta font-medium text-text">{item.label}</span>
              <span className="block text-label text-text-muted">{item.detail}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function BellMenu({ items, updates }: { items: BellItem[]; updates: UpdateItem[] }) {
  const [open, setOpen] = useState(false);
  const [seen, setSeen] = useState(false);
  const ref = useDismiss(open, setOpen);
  const unread = !seen && updates.some((u) => u.unread);
  const toggle = () => {
    setOpen(!open);
    if (!open && unread) {
      setSeen(true);
      void markUpdatesRead();
    }
  };
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={toggle}
        aria-label={items.length ? `${items.length} ${items.length === 1 ? "thing needs" : "things need"} you` : unread ? "New updates" : "Nothing needs you right now"}
        aria-expanded={open}
        className="relative flex h-8 w-8 items-center justify-center rounded-control text-text-muted hover:bg-subtle hover:text-text"
      >
        <Bell size={17} strokeWidth={ICON_STROKE} aria-hidden />
        {(items.length > 0 || unread) && <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-brand" aria-hidden />}
      </button>
      {open && (
        <div className="fixed inset-x-2 top-14 z-40 max-h-menu overflow-y-auto rounded-control border border-border bg-surface shadow-popover sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-1.5 sm:w-96">
          <p className="px-4 pb-1 pt-3 text-eyebrow font-semibold uppercase text-text-faint">Needs you</p>
          {items.length === 0 ? (
            <p className="px-4 pb-3 text-meta text-text-muted">Nothing needs you right now.</p>
          ) : (
            <div className="divide-y divide-border">
              {items.map((item) => (
                <Link key={item.key} href={item.href} onClick={() => setOpen(false)} className="block px-4 py-2.5 hover:bg-subtle">
                  <span className="block text-meta font-medium text-text">{item.title}</span>
                  <span className="block text-label text-text-muted">{item.reason}</span>
                </Link>
              ))}
            </div>
          )}
          {updates.length > 0 && (
            <>
              <p className="border-t border-border px-4 pb-1 pt-3 text-eyebrow font-semibold uppercase text-text-faint">Updates</p>
              <div className="divide-y divide-border">
                {updates.map((u) => (
                  <Link key={u.id} href={u.href} onClick={() => setOpen(false)} className="block px-4 py-2.5 hover:bg-subtle">
                    <span className={cx("block text-meta text-text", u.unread && "font-semibold")}>{u.title}</span>
                    <span className="block text-label text-text-muted">
                      {u.body} · {u.when}
                    </span>
                  </Link>
                ))}
              </div>
            </>
          )}
          <Link href="/settings" onClick={() => setOpen(false)} className="block border-t border-border px-4 py-2.5 text-label text-text-muted hover:text-text">
            Notification settings
          </Link>
        </div>
      )}
    </div>
  );
}

export function TopBar({ bellItems, updates, onMenu }: { bellItems: BellItem[]; updates: UpdateItem[]; onMenu: () => void }) {
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
    <header className="sticky top-0 z-30 flex h-topbar items-center gap-2 border-b border-border bg-background/95 px-3 backdrop-blur sm:px-6">
      <button type="button" onClick={onMenu} className="flex h-8 w-8 items-center justify-center rounded-control text-text-muted hover:bg-subtle lg:hidden" aria-label="Open navigation">
        <Menu size={18} strokeWidth={ICON_STROKE} aria-hidden />
      </button>
      <Link href="/" className="lg:hidden" aria-label="Spine home">
        <Logo tone="light" />
      </Link>
      <button
        type="button"
        onClick={() => setPaletteOpen(true)}
        className="ml-auto flex h-8 items-center gap-2 rounded-control border border-border bg-surface px-2.5 text-left text-label text-text-muted hover:border-border-strong lg:ml-0 lg:w-full lg:max-w-search"
        aria-label="Search"
      >
        <Search size={15} strokeWidth={ICON_STROKE} aria-hidden />
        <span className="hidden flex-1 lg:inline">Search questions, initiatives, playbook...</span>
        <kbd className="hidden rounded-sm border border-border bg-subtle px-1.5 font-sans text-tiny text-text-muted lg:inline">⌘K</kbd>
      </button>
      <div className="flex items-center gap-1.5 lg:ml-auto">
        <NewMenu />
        <BellMenu items={bellItems} updates={updates} />
      </div>
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </header>
  );
}
