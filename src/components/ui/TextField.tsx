import { forwardRef } from "react";
import { Search } from "lucide-react";
import { cx } from "@/lib/cx";
import { Field, controlClass } from "./Field";
import { ICON_STROKE } from "./icons";

type Props = React.InputHTMLAttributes<HTMLInputElement> & { label?: string; search?: boolean };

export const TextField = forwardRef<HTMLInputElement, Props>(function TextField({ label, search, className, id, ...rest }, ref) {
  const input = (
    <div className="relative h-fit w-full">
      {search && (
        <Search size={20} strokeWidth={ICON_STROKE} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-text-muted" aria-hidden />
      )}
      <input ref={ref} id={id} className={cx(controlClass, "w-full", search && "pl-12", className)} {...rest} />
    </div>
  );
  return label ? <Field label={label} htmlFor={id}>{input}</Field> : input;
});
