import { cx } from "@/lib/cx";

/** Label wrapper shared by every form control. */
export function Field({ label, htmlFor, children, className }: { label?: string; htmlFor?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cx("flex flex-col gap-2", className)}>
      {label && (
        <label htmlFor={htmlFor} className="text-label font-medium text-text">
          {label}
        </label>
      )}
      {children}
    </div>
  );
}

export const controlClass =
  "h-12 rounded-control border border-border bg-surface px-4 text-meta text-text placeholder:text-text-muted focus:border-brand focus:outline-none disabled:bg-neutral-soft";
