import { cx } from "@/lib/cx";

export function Field({ label, hint, htmlFor, children, className }: { label?: string; hint?: string; htmlFor?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cx("flex flex-col gap-1.5", className)}>
      {label && (
        <label htmlFor={htmlFor} className="text-label font-medium text-text">
          {label}
        </label>
      )}
      {children}
      {hint && <p className="text-tiny text-text-muted">{hint}</p>}
    </div>
  );
}

export const controlClass =
  "h-control rounded-control border border-border-strong bg-surface px-3 text-meta text-text placeholder:text-text-faint focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20 disabled:bg-subtle";
