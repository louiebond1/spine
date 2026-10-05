import Link from "next/link";
import { cx } from "@/lib/cx";

export type Tab = { key: string; label: string; href: string; count?: number };

/** Plain text tabs with an underline on the active one. */
export function Tabs({ tabs, active, className, bordered = false }: { tabs: Tab[]; active: string; className?: string; bordered?: boolean }) {
  return (
    <nav className={cx("flex gap-10", bordered && "border-b border-border", className)}>
      {tabs.map((t) => {
        const isActive = t.key === active;
        return (
          <Link
            key={t.key}
            href={t.href}
            aria-current={isActive ? "page" : undefined}
            className={cx(
              "-mb-px border-b-2 pb-3 text-meta transition-colors",
              isActive ? "border-brand font-medium text-brand" : "border-transparent text-text hover:text-brand",
            )}
          >
            {t.label}
            {t.count !== undefined && <span className="ml-3 text-label text-text-muted">{t.count}</span>}
          </Link>
        );
      })}
    </nav>
  );
}
