"use client";

import { cx } from "@/lib/cx";

/** One calm grey sentence. */
export function EmptyState({ children, className }: { children: React.ReactNode; className?: string }) {
  return <p className={cx("py-6 text-meta text-text-muted", className)}>{children}</p>;
}

/** One calm grey sentence with a retry link. */
export function ErrorState({ message = "Something went wrong.", onRetry }: { message?: string; onRetry: () => void }) {
  return (
    <p className="py-6 text-meta text-text-muted">
      {message}{" "}
      <button type="button" onClick={onRetry} className="font-medium text-brand hover:text-brand-hover">
        Try again
      </button>
    </p>
  );
}

/** Skeleton rows shaped like real rows. */
export function SkeletonRows({ count = 3, leading = true }: { count?: number; leading?: boolean }) {
  return (
    <div className="divide-y divide-border" aria-busy="true" aria-label="Loading">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="flex items-center gap-4 py-4">
          {leading && <span className="h-tile w-tile shrink-0 animate-pulse rounded-control bg-subtle" />}
          <span className="flex-1 space-y-2">
            <span className="block h-4 w-1/3 animate-pulse rounded-sm bg-subtle" />
            <span className="block h-3 w-1/2 animate-pulse rounded-sm bg-subtle" />
          </span>
        </div>
      ))}
    </div>
  );
}

/** A quiet inline notice: info, or a warning/critical one with words that say what to do. */
export function Notice({ tone = "info", children, className }: { tone?: "info" | "warning" | "critical" | "positive"; children: React.ReactNode; className?: string }) {
  return (
    <div
      role={tone === "critical" ? "alert" : "status"}
      className={cx(
        "rounded-control border px-3 py-2.5 text-meta",
        tone === "info" && "border-border bg-subtle text-text",
        tone === "warning" && "border-warning/30 bg-warning-soft text-text",
        tone === "critical" && "border-critical/30 bg-critical-soft text-text",
        tone === "positive" && "border-positive/30 bg-positive-soft text-text",
        className,
      )}
    >
      {children}
    </div>
  );
}
