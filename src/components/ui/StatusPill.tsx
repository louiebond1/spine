import { cx } from "@/lib/cx";

export type Status = "ON_TRACK" | "AT_RISK" | "BLOCKED";

const LABEL: Record<Status, string> = { ON_TRACK: "On track", AT_RISK: "At risk", BLOCKED: "Blocked" };

/** Check-in status: a small dot and the word, so colour is never the only signal. */
export function StatusPill({ status }: { status: Status }) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-tiny font-medium",
        status === "ON_TRACK" && "bg-positive-soft text-positive",
        status === "AT_RISK" && "bg-warning-soft text-warning",
        status === "BLOCKED" && "bg-critical-soft text-critical",
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
      {LABEL[status]}
    </span>
  );
}
