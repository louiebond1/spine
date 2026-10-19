import { forwardRef } from "react";
import { Search } from "lucide-react";
import { cx } from "@/lib/cx";
import { Field, controlClass } from "./Field";
import { ICON_STROKE } from "./icons";

type Props = React.InputHTMLAttributes<HTMLInputElement> & { label?: string; hint?: string; search?: boolean };

export const TextField = forwardRef<HTMLInputElement, Props>(function TextField({ label, hint, search, className, id, ...rest }, ref) {
  const input = (
    <div className="relative h-fit w-full">
      {search && <Search size={15} strokeWidth={ICON_STROKE} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-faint" aria-hidden />}
      <input ref={ref} id={id} className={cx(controlClass, "w-full", search && "pl-9", className)} {...rest} />
    </div>
  );
  return label || hint ? (
    <Field label={label} hint={hint} htmlFor={id}>
      {input}
    </Field>
  ) : (
    input
  );
});
