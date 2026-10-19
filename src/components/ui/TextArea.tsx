import { forwardRef } from "react";
import { cx } from "@/lib/cx";
import { Field } from "./Field";

type Props = React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string; hint?: string };

export const TextArea = forwardRef<HTMLTextAreaElement, Props>(function TextArea({ label, hint, className, id, rows = 3, ...rest }, ref) {
  const area = (
    <textarea
      ref={ref}
      id={id}
      rows={rows}
      className={cx(
        "w-full rounded-control border border-border-strong bg-surface px-3 py-2 text-meta text-text placeholder:text-text-faint focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20",
        className,
      )}
      {...rest}
    />
  );
  return label || hint ? (
    <Field label={label} hint={hint} htmlFor={id}>
      {area}
    </Field>
  ) : (
    area
  );
});
