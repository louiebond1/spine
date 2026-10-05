import type { LucideIcon } from "lucide-react";
import { ICON_STROKE } from "./icons";

export function IconTile({ icon: Icon }: { icon: LucideIcon }) {
  return (
    <span className="inline-flex h-tile w-tile shrink-0 items-center justify-center rounded-control bg-neutral-soft text-text" aria-hidden>
      <Icon size={22} strokeWidth={ICON_STROKE} />
    </span>
  );
}
