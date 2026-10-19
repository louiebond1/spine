"use client";

import { Check } from "lucide-react";
import { cx } from "@/lib/cx";

type Props = Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> & { label?: React.ReactNode };

export function Checkbox({ label, className, disabled, ...rest }: Props) {
  return (
    <label className={cx("inline-flex items-center gap-2.5 text-meta text-text", disabled ? "cursor-default" : "cursor-pointer", className)}>
      <span className="relative inline-flex h-4 w-4 shrink-0">
        <input
          type="checkbox"
          disabled={disabled}
          className="peer h-4 w-4 appearance-none rounded-sm border border-border-strong bg-surface checked:border-brand checked:bg-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          {...rest}
        />
        <Check size={12} strokeWidth={3} className="pointer-events-none absolute left-0.5 top-0.5 hidden text-on-brand peer-checked:block" aria-hidden />
      </span>
      {label}
    </label>
  );
}
