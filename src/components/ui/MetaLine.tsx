import { Fragment } from "react";
import { cx } from "@/lib/cx";

/** Muted, dot-separated line: "Ben Carter · Security · 2h ago". */
export function MetaLine({ parts, className }: { parts: React.ReactNode[]; className?: string }) {
  const items = parts.filter((p) => p !== null && p !== undefined && p !== false && p !== "");
  return (
    <p className={cx("text-meta text-text-muted", className)}>
      {items.map((part, i) => (
        <Fragment key={i}>
          {i > 0 && <span className="mx-2" aria-hidden>·</span>}
          {part}
        </Fragment>
      ))}
    </p>
  );
}
