import { forwardRef } from "react";
import { cx } from "@/lib/cx";
import { Field } from "./Field";

type Props = React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string };

export const TextArea = forwardRef<HTMLTextAreaElement, Props>(function TextArea({ label, className, id, rows = 3, ...rest }, ref) {
  const area = (
    <textarea
      ref={ref}
      id={id}
      rows={rows}
      className={cx(
        "w-full rounded-control border border-border bg-surface px-4 py-3 text-meta text-text placeholder:text-text-muted focus:border-brand focus:outline-none",
        className,
      )}
      {...rest}
    />
  );
  return label ? <Field label={label} htmlFor={id}>{area}</Field> : area;
});
