import type { LucideIcon } from "lucide-react";
import { cx } from "@/lib/cx";
import { ICON_STROKE } from "./icons";

export function IconTile({ icon: Icon, tone = "neutral" }: { icon: LucideIcon; tone?: "neutral" | "brand" | "critical" | "warning" }) {
  return (
    <span
      className={cx(
        "inline-flex h-tile w-tile shrink-0 items-center justify-center rounded-control",
        tone === "neutral" && "bg-subtle text-text-muted",
        tone === "brand" && "bg-brand-soft text-brand",
        tone === "critical" && "bg-critical-soft text-critical",
        tone === "warning" && "bg-warning-soft text-warning",
      )}
      aria-hidden
    >
      <Icon size={18} strokeWidth={ICON_STROKE} />
    </span>
  );
}
