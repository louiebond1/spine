import Link from "next/link";
import { cx } from "@/lib/cx";

type Option = { key: string; label: string; href: string };

/** Two-option toggle: active is white with a brand border, inactive sits on neutral-soft. */
export function SegmentedToggle({ options, active, size = "md" }: { options: Option[]; active: string; size?: "md" | "sm" }) {
  return (
    <div className="inline-flex rounded-control bg-neutral-soft">
      {options.map((o) => (
        <Link
          key={o.key}
          href={o.href}
          aria-current={o.key === active ? "true" : undefined}
          className={cx(
            "flex items-center justify-center rounded-control border px-8",
            size === "md" ? "h-11 text-meta" : "h-10 text-label",
            o.key === active ? "border-brand bg-surface text-brand" : "border-transparent text-text-muted hover:text-text",
          )}
        >
          {o.label}
        </Link>
      ))}
    </div>
  );
}
