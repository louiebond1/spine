import { cx } from "@/lib/cx";

/** Compact stage track: done stages filled, the current one marked, upcoming ones quiet. */
export function Stepper({ steps, current }: { steps: string[]; current: number }) {
  return (
    <div className="w-full max-w-narrow">
      <ol className="flex w-full items-center gap-1" aria-label="Stage">
        {steps.map((label, i) => {
          const done = i < current;
          const active = i === current;
          return (
            <li key={label} className="min-w-0 flex-1">
              <span className={cx("block h-1 rounded-full", done || active ? "bg-brand" : "bg-border")} aria-hidden />
              <span className={cx("mt-1.5 hidden truncate text-tiny sm:block", active ? "font-semibold text-text" : done ? "text-text-muted" : "text-text-faint")}>{label}</span>
              <span className="sr-only">{done ? "done" : active ? "current stage" : "upcoming"}</span>
            </li>
          );
        })}
      </ol>
      {/* Phones: six labels don't fit, so name the current stage once. */}
      <p className="mt-1.5 text-tiny text-text-muted sm:hidden" aria-hidden>
        <span className="font-semibold text-text">{steps[Math.min(current, steps.length - 1)]}</span> · stage {Math.min(current + 1, steps.length)} of {steps.length}
      </p>
    </div>
  );
}
