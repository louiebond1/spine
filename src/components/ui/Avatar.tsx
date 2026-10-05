import { User } from "lucide-react";
import { cx } from "@/lib/cx";
import { ICON_STROKE } from "./icons";

type Props = {
  /** Initials, or null for an anonymous asker. */
  initials: string | null;
  size?: "md" | "sm";
  className?: string;
};

export function Avatar({ initials, size = "md", className }: Props) {
  return (
    <span
      className={cx(
        "inline-flex shrink-0 items-center justify-center rounded-full bg-neutral-soft font-semibold text-text",
        size === "md" ? "h-avatar w-avatar text-meta" : "h-avatar-sm w-avatar-sm text-label",
        className,
      )}
      aria-hidden
    >
      {initials ?? <User size={size === "md" ? 24 : 20} strokeWidth={ICON_STROKE} />}
    </span>
  );
}
