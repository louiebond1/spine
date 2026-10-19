"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, BookOpen, ChartColumn, ChevronsUpDown, Compass, House, LogOut, MessageCircle, Settings, SlidersHorizontal, Waypoints, type LucideIcon } from "lucide-react";
import { cx } from "@/lib/cx";
import { ICON_STROKE } from "@/components/ui/icons";
import { logout } from "@/server/auth/actions";
import { Logo } from "./Logo";

export type NavUser = { name: string; initials: string; roles: string; orgName: string };
export type NavAccess = { pulse: boolean; leadership: boolean; admin: boolean };

type NavItem = { href: string; label: string; icon: LucideIcon; count?: number };

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

function NavLink({ item, pathname, onNavigate }: { item: NavItem; pathname: string; onNavigate?: () => void }) {
  const active = isActive(pathname, item.href);
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cx(
        "flex h-8 items-center gap-2.5 rounded-control px-2.5 text-meta transition-colors",
        active ? "bg-nav-raised font-medium text-nav-strong" : "text-nav-text hover:bg-nav-raised hover:text-nav-strong",
      )}
    >
      <Icon size={16} strokeWidth={ICON_STROKE} aria-hidden className={active ? "text-nav-strong" : "text-nav-muted"} />
      <span className="flex-1 truncate">{item.label}</span>
      {item.count ? <span className="min-w-5 rounded-full bg-nav-border px-1.5 text-center text-tiny font-semibold text-nav-strong">{item.count}</span> : null}
    </Link>
  );
}

function UserMenu({ user }: { user: NavUser }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);
  return (
    <div ref={ref} className="relative border-t border-nav-border p-2">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="flex w-full items-center gap-2.5 rounded-control px-2 py-2 text-left hover:bg-nav-raised"
      >
        <span className="flex h-avatar w-avatar shrink-0 items-center justify-center rounded-full bg-nav-raised text-label font-semibold text-nav-strong" aria-hidden>
          {user.initials}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-meta font-medium text-nav-strong">{user.name}</span>
          <span className="block truncate text-tiny text-nav-muted">{user.orgName}</span>
        </span>
        <ChevronsUpDown size={14} strokeWidth={ICON_STROKE} className="text-nav-muted" aria-hidden />
      </button>
      {open && (
        <div className="absolute bottom-full left-2 right-2 z-50 mb-1 rounded-control border border-border bg-surface py-1 shadow-popover">
          <p className="px-3 py-2 text-tiny text-text-muted">{user.roles}</p>
          <Link href="/settings" onClick={() => setOpen(false)} className="flex items-center gap-2 px-3 py-2 text-meta text-text hover:bg-subtle">
            <SlidersHorizontal size={15} strokeWidth={ICON_STROKE} aria-hidden />
            Settings
          </Link>
          <form action={logout}>
            <button type="submit" className="flex w-full items-center gap-2 px-3 py-2 text-left text-meta text-text hover:bg-subtle">
              <LogOut size={15} strokeWidth={ICON_STROKE} aria-hidden />
              Sign out
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

/** The navy navigation: the four pillars in the order people use them, then management. */
export function SidebarNav({ user, access, pulseCount, onNavigate }: { user: NavUser; access: NavAccess; pulseCount: number; onNavigate?: () => void }) {
  const pathname = usePathname();
  const main: NavItem[] = [
    { href: "/", label: "Home", icon: House },
    { href: "/playbook", label: "Playbook", icon: BookOpen },
    { href: "/help-desk", label: "Help Desk", icon: MessageCircle },
    { href: "/discover", label: "Discover", icon: Compass },
    { href: "/ideas", label: "Initiatives", icon: Waypoints },
    ...(access.pulse ? [{ href: "/pulse", label: "Pulse", icon: Activity, count: pulseCount }] : []),
  ];
  const manage: NavItem[] = [
    ...(access.leadership ? [{ href: "/leadership", label: "Leadership", icon: ChartColumn }] : []),
    ...(access.admin ? [{ href: "/admin", label: "Admin", icon: Settings }] : []),
  ];
  return (
    <div className="flex h-full flex-col bg-nav">
      <div className="flex h-topbar shrink-0 items-center px-4">
        <Link href="/" aria-label="Spine home" onClick={onNavigate}>
          <Logo />
        </Link>
      </div>
      <nav className="flex flex-1 flex-col gap-6 overflow-y-auto px-2 pt-2" aria-label="Main">
        <div className="space-y-0.5">
          {main.map((item) => (
            <NavLink key={item.href} item={item} pathname={pathname} onNavigate={onNavigate} />
          ))}
        </div>
        {manage.length > 0 && (
          <div>
            <p className="mb-1 px-2.5 text-eyebrow font-semibold uppercase text-nav-muted">Manage</p>
            <div className="space-y-0.5">
              {manage.map((item) => (
                <NavLink key={item.href} item={item} pathname={pathname} onNavigate={onNavigate} />
              ))}
            </div>
          </div>
        )}
      </nav>
      <UserMenu user={user} />
    </div>
  );
}
