import Link from "next/link";
import { cx } from "@/lib/cx";

type Option = { key: string; label: string; href: string };

export function SegmentedToggle({ options, active }: { options: Option[]; active: string; size?: "md" | "sm" }) {
  return (
    <div className="inline-flex rounded-control border border-border bg-subtle p-0.5">
      {options.map((o) => (
        <Link
          key={o.key}
          href={o.href}
          aria-current={o.key === active ? "true" : undefined}
          className={cx(
            "flex h-8 items-center justify-center rounded-control px-3 text-label font-medium",
            o.key === active ? "border border-border bg-surface text-text" : "border border-transparent text-text-muted hover:text-text",
          )}
        >
          {o.label}
        </Link>
      ))}
    </div>
  );
}
