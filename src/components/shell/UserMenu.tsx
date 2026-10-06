"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, ChevronRight } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { ICON_STROKE } from "@/components/ui/icons";
import { cx } from "@/lib/cx";
import { switchUser } from "@/server/session-actions";

export type SwitcherUser = { id: string; name: string; initials: string; roles: string };

/** Bottom of the sidebar: who you are, and the demo user switcher. */
export function UserMenu({ user, users }: { user: SwitcherUser; users: SwitcherUser[] }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const pick = (id: string) =>
    start(async () => {
      await switchUser(id);
      setOpen(false);
      router.refresh();
    });

  return (
    <div ref={ref} className="relative px-5 pb-6">
      {open && (
        <div className="absolute bottom-full left-4 right-4 mb-2 rounded-container border border-border bg-surface py-2" role="menu">
          <Link href="/settings" onClick={() => setOpen(false)} className="block px-4 py-2 text-meta text-text hover:bg-neutral-soft">
            Your settings
          </Link>
          <p className="mt-1 border-t border-border px-4 pb-2 pt-3 text-label text-text-muted">View as</p>
          {users.map((u) => (
            <button
              key={u.id}
              type="button"
              role="menuitem"
              disabled={pending}
              onClick={() => pick(u.id)}
              className="flex w-full items-center gap-3 px-4 py-2 text-left hover:bg-neutral-soft"
            >
              <Avatar initials={u.initials} size="sm" />
              <span className="min-w-0 flex-1">
                <span className={cx("block truncate text-label", u.id === user.id ? "font-semibold text-brand" : "text-text")}>{u.name}</span>
                <span className="block truncate text-tiny text-text-muted">{u.roles}</span>
              </span>
              {u.id === user.id && <Check size={16} strokeWidth={ICON_STROKE} className="text-brand" aria-hidden />}
            </button>
          ))}
        </div>
      )}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex w-full items-center gap-4 text-left"
      >
        <Avatar initials={user.initials} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-meta text-text">{user.name}</span>
          <span className="block truncate text-label text-text-muted">{user.roles}</span>
        </span>
        <ChevronRight size={18} strokeWidth={ICON_STROKE} className="text-text-muted" aria-hidden />
      </button>
    </div>
  );
}
