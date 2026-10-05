import { forwardRef } from "react";
import { ChevronDown } from "lucide-react";
import { cx } from "@/lib/cx";
import { Field, controlClass } from "./Field";
import { ICON_STROKE } from "./icons";

type Option = { value: string; label: string };
type Props = React.SelectHTMLAttributes<HTMLSelectElement> & { label?: string; options: Option[] };

export const Select = forwardRef<HTMLSelectElement, Props>(function Select({ label, options, className, id, ...rest }, ref) {
  const select = (
    <div className="relative h-fit w-full">
      <select ref={ref} id={id} className={cx(controlClass, "w-full appearance-none pr-12", className)} {...rest}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown size={22} strokeWidth={ICON_STROKE} className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-text" aria-hidden />
    </div>
  );
  return label ? <Field label={label} htmlFor={id}>{select}</Field> : select;
});
