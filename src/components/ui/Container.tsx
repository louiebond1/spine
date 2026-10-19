import { cx } from "@/lib/cx";
import { SectionLabel } from "./SectionLabel";

type Props = {
  label?: string;
  heading?: React.ReactNode;
  count?: number;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  /** Rows are divided by thin lines; "plain" content is padded instead. */
  variant?: "rows" | "plain";
  children: React.ReactNode;
};

/** One container per section. Never cards inside cards. */
export function Container({ label, heading, count, description, action, className, variant = "rows", children }: Props) {
  return (
    <section className={cx("rounded-container border border-border bg-surface", className)}>
      {(heading || label || action) && (
        <header className="flex items-start justify-between gap-4 border-b border-border px-4 py-3 sm:px-5">
          <div className="min-w-0">
            {heading && (
              <h2 className="text-section font-semibold text-text">
                {heading}
                {count !== undefined && <span className="ml-2 text-label font-medium text-text-faint">{count}</span>}
              </h2>
            )}
            {label && <SectionLabel>{label}</SectionLabel>}
            {description && <p className="mt-0.5 text-label text-text-muted">{description}</p>}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </header>
      )}
      {variant === "rows" ? <div className="divide-y divide-border px-4 sm:px-5">{children}</div> : <div className="p-4 sm:p-5">{children}</div>}
    </section>
  );
}
