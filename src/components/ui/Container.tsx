import { cx } from "@/lib/cx";
import { SectionLabel } from "./SectionLabel";

type Props = {
  /** Uppercase label inside the top of the container ("RECENT WINS"). */
  label?: string;
  /** Section heading ("Your work", "Unclaimed") with optional count and right-side action. */
  heading?: React.ReactNode;
  count?: number;
  action?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
};

/** One container per section. Children are usually Rows, divided by thin lines. */
export function Container({ label, heading, count, action, className, children }: Props) {
  return (
    <section className={cx("rounded-container border border-border bg-surface px-6", className)}>
      {(heading || label || action) && (
        <header className={cx("flex items-center justify-between gap-4", heading ? "border-b border-border pb-3 pt-4" : "pb-1 pt-6")}>
          {heading && (
            <h2 className="text-section font-semibold text-text">
              {heading}
              {count !== undefined && <span className="ml-3 text-label font-medium text-text-muted">{count}</span>}
            </h2>
          )}
          {label && <SectionLabel>{label}</SectionLabel>}
          {action}
        </header>
      )}
     <div className="divide-y divide-border">{children}</div>
    </section>
  );
}
