import { forwardRef } from "react";
import { cx } from "@/lib/cx";
import { controlClass } from "./Field";

type Props = Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> & { suffix?: string };

/** Small number input with an optional unit after it ("7 days"). */
export const NumberField = forwardRef<HTMLInputElement, Props>(function NumberField({ suffix, className, ...rest }, ref) {
  return (
    <span className="inline-flex items-center gap-4">
      <input ref={ref} type="number" inputMode="numeric" className={cx(controlClass, "w-24", className)} {...rest} />
      {suffix && <span className="min-w-12 text-meta text-text-muted">{suffix}</span>}
    </span>
  );
});
