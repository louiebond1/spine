import { cx } from "@/lib/cx";

/** Compact stage track: done stages filled, the current one marked, upcoming ones quiet. */
export function Stepper({ steps, current }: { steps: string[]; current: number }) {
  return (
    <ol className="flex w-full max-w-narrow items-center gap-1" aria-label="Stage">
      {steps.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li key={label} className="min-w-0 flex-1">
            <span className={cx("block h-1 rounded-full", done || active ? "bg-brand" : "bg-border")} aria-hidden />
            <span className={cx("mt-1.5 block truncate text-tiny", active ? "font-semibold text-text" : done ? "text-text-muted" : "text-text-faint")}>{label}</span>
            <span className="sr-only">{done ? "done" : active ? "current stage" : "upcoming"}</span>
          </li>
        );
      })}
    </ol>
  );
}
