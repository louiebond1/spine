import { User } from "lucide-react";
import { cx } from "@/lib/cx";
import { ICON_STROKE } from "./icons";

/** Neutral initials avatar; anonymous askers get a plain person icon. */
export function Avatar({ initials, size = "md", className }: { initials: string | null; size?: "md" | "sm"; className?: string }) {
  return (
    <span
      className={cx(
        "inline-flex shrink-0 items-center justify-center rounded-full border border-border bg-subtle font-semibold text-text-muted",
        size === "md" ? "h-avatar w-avatar text-label" : "h-avatar-sm w-avatar-sm text-tiny",
        className,
      )}
      aria-hidden
    >
      {initials ?? <User size={size === "md" ? 16 : 13} strokeWidth={ICON_STROKE} />}
    </span>
  );
}
