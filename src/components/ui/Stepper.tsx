import { Check } from "lucide-react";
import { cx } from "@/lib/cx";

/** Small stage stepper (08). `current` is the index of the active stage. */
export function Stepper({ steps, current }: { steps: string[]; current: number }) {
  return (
    <ol className="-ml-9 flex items-start">
      {steps.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li key={label} className="relative flex w-24 flex-col items-center">
            {i > 0 && (
              <span
                className={cx("absolute right-1/2 top-3 h-px w-full -translate-y-1/2", i <= current ? "bg-brand" : "bg-border")}
                aria-hidden
              />
            )}
            <span
              className={cx(
                "relative z-10 flex h-6 w-6 items-center justify-center rounded-full border-2",
                done && "border-brand bg-brand text-surface",
                active && "border-brand bg-surface",
                !done && !active && "border-border bg-surface",
              )}
            >
              {done && <Check size={12} strokeWidth={3} aria-hidden />}
              {active && <span className="h-3 w-3 rounded-full bg-brand" aria-hidden />}
            </span>
            <span className={cx("mt-2 text-tiny", active ? "font-semibold text-text" : "text-text-muted")}>{label}</span>
            <span className="sr-only">{done ? "done" : active ? "current stage" : "upcoming"}</span>
          </li>
        );
      })}
    </ol>
  );
}
