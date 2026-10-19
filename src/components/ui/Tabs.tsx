import Link from "next/link";
import { cx } from "@/lib/cx";

export type Tab = { key: string; label: string; href: string; count?: number };

/** Text tabs with an underline on the active one. Scrolls sideways on phones. */
export function Tabs({ tabs, active, className }: { tabs: Tab[]; active: string; className?: string; bordered?: boolean }) {
  return (
    <nav className={cx("-mx-4 overflow-x-auto border-b border-border px-4 sm:mx-0 sm:px-0", className)}>
      <div className="flex gap-6">
        {tabs.map((t) => {
          const isActive = t.key === active;
          return (
            <Link
              key={t.key}
              href={t.href}
              scroll={false}
              aria-current={isActive ? "page" : undefined}
              className={cx(
                "-mb-px whitespace-nowrap border-b-2 pb-2.5 text-meta transition-colors",
                isActive ? "border-text font-medium text-text" : "border-transparent text-text-muted hover:text-text",
              )}
            >
              {t.label}
              {t.count !== undefined && <span className="ml-1.5 text-label text-text-faint">{t.count}</span>}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
