"use client";

import { cx } from "@/lib/cx";

/** One calm grey sentence. */
export function EmptyState({ children, className }: { children: React.ReactNode; className?: string }) {
  return <p className={cx("py-6 text-meta text-text-muted", className)}>{children}</p>;
}

/** One calm grey sentence with a retry text link. */
export function ErrorState({ message = "Something went wrong.", onRetry }: { message?: string; onRetry: () => void }) {
  return (
    <p className="py-6 text-meta text-text-muted">
      {message}{" "}
      <button type="button" onClick={onRetry} className="text-brand hover:text-brand-hover">
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
        <div key={i} className="flex items-center gap-6 py-5">
          {leading && <span className="h-tile w-tile shrink-0 animate-pulse rounded-control bg-neutral-soft" />}
          <span className="flex-1 space-y-3">
            <span className="block h-5 w-1/3 animate-pulse rounded-sm bg-neutral-soft" />
            <span className="block h-4 w-1/2 animate-pulse rounded-sm bg-neutral-soft" />
          </span>
        </div>
      ))}
    </div>
  );
}
