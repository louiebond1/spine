"use client";

import { Check } from "lucide-react";
import { cx } from "@/lib/cx";

type Props = Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> & { label?: React.ReactNode };

export function Checkbox({ label, className, disabled, ...rest }: Props) {
  return (
    <label className={cx("inline-flex items-center gap-3 text-meta text-text", disabled ? "cursor-default" : "cursor-pointer", className)}>
      <span className="relative inline-flex h-6 w-6 shrink-0">
        <input type="checkbox" disabled={disabled} className="peer h-6 w-6 appearance-none rounded-sm border border-text-muted bg-surface checked:border-brand checked:bg-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand" {...rest} />
        <Check size={16} strokeWidth={3} className="pointer-events-none absolute left-1 top-1 hidden text-surface peer-checked:block" aria-hidden />
      </span>
      {label}
    </label>
  );
}
