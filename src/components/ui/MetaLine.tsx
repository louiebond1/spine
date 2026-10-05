import { Fragment } from "react";
import { cx } from "@/lib/cx";

/** Muted, dot-separated line: "Ben Carter · Security · 2h ago". */
export function MetaLine({ parts, className, size = "meta" }: { parts: React.ReactNode[]; className?: string; size?: "meta" | "label" }) {
  const items = parts.filter((p) => p !== null && p !== undefined && p !== false && p !== "");
  return (
    <p className={cx(size === "label" ? "text-label" : "text-meta", "text-text-muted", className)}>
      {items.map((part, i) => (
        <Fragment key={i}>
          {i > 0 && (
            <>
              {" "}
              <span className={size === "label" ? "" : "mx-1"} aria-hidden>
                ·
              </span>{" "}
            </>
          )}
          <span className="whitespace-nowrap">{part}</span>
        </Fragment>
      ))}
    </p>
  );
}
