import { Page } from "@/components/shell/Shell";
import { SkeletonRows } from "@/components/ui/States";

/** Skeleton rows in the same shape as the real rows while a page loads. */
export default function Loading() {
  return (
    <Page>
      <div className="mb-8 space-y-3" aria-hidden>
        <span className="block h-5 w-48 animate-pulse rounded-sm bg-neutral-soft" />
        <span className="block h-10 w-80 animate-pulse rounded-sm bg-neutral-soft" />
      </div>
      <section className="rounded-container border border-border bg-surface px-6">
        <SkeletonRows count={3} />
      </section>
    </Page>
  );
}
