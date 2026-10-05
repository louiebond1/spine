"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, ChartColumn, House, Lightbulb, MessageCircle, Settings, Trophy, type LucideIcon } from "lucide-react";
import { cx } from "@/lib/cx";
import { ICON_STROKE } from "@/components/ui/icons";
import { Logo } from "./Logo";
import { UserMenu, type SwitcherUser } from "./UserMenu";

type NavItem = { href: string; label: string; icon: LucideIcon; count?: number };

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

function NavLink({ item, pathname }: { item: NavItem; pathname: string }) {
  const active = isActive(pathname, item.href);
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cx(
        "flex h-12 items-center gap-6 rounded-control px-5 text-meta",
        active ? "bg-brand-soft text-brand" : "text-text hover:bg-neutral-soft",
      )}
    >
      <Icon size={28} strokeWidth={ICON_STROKE} aria-hidden />
      <span className="flex-1">{item.label}</span>
      {item.count ? (
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-soft text-label font-semibold text-brand">
          {item.count}
        </span>
      ) : null}
    </Link>
  );
}

type Props = {
  user: SwitcherUser;
  users: SwitcherUser[];
  isAdmin: boolean;
  pulseCount: number;
};

export function Sidebar({ user, users, isAdmin, pulseCount }: Props) {
  const pathname = usePathname();
  const main: NavItem[] = [
    { href: "/", label: "Home", icon: House },
    { href: "/help-desk", label: "Help Desk", icon: MessageCircle },
    { href: "/ideas", label: "Ideas & Projects", icon: Lightbulb },
    { href: "/pulse", label: "Pulse", icon: Activity, count: pulseCount },
    { href: "/leaderboard", label: "Leaderboard", icon: Trophy },
  ];
  const manage: NavItem[] = [
    { href: "/programme", label: "Programme", icon: ChartColumn },
    { href: "/admin", label: "Admin", icon: Settings },
  ];

  return (
    <aside className="fixed inset-y-0 left-0 flex w-sidebar flex-col border-r border-border bg-surface">
      <div className="flex h-topbar shrink-0 items-center border-b border-border px-8">
        <Link href="/" aria-label="Spine home">
          <Logo />
        </Link>
      </div>
      <nav className="flex flex-1 flex-col px-4 pt-6">
        <div className="space-y-0.5">
          {main.map((item) => (
            <NavLink key={item.href} item={item} pathname={pathname} />
          ))}
        </div>
        {isAdmin && (
          <>
            <div className="mx-2 mb-5 mt-2 border-t border-border" />
            <p className="mb-2 px-2 text-label text-text-muted">Manage</p>
            <div className="space-y-0.5">
              {manage.map((item) => (
                <NavLink key={item.href} item={item} pathname={pathname} />
              ))}
            </div>
          </>
        )}
      </nav>
      <UserMenu user={user} users={users} />
    </aside>
  );
}
