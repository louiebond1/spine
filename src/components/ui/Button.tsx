import Link from "next/link";
import { ArrowRight, type LucideIcon } from "lucide-react";
import { cx } from "@/lib/cx";
import { ICON_STROKE } from "./icons";

type Variant = "primary" | "secondary" | "text";

type CommonProps = {
  variant?: Variant;
  arrow?: boolean;
  icon?: LucideIcon;
  fullWidth?: boolean;
  className?: string;
  children: React.ReactNode;
};

type ButtonProps = CommonProps &
  Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "className" | "children"> & { href?: undefined };
type LinkProps = CommonProps & { href: string; prefetch?: boolean };

const base =
  "inline-flex items-center justify-center gap-3 whitespace-nowrap text-meta font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-not-allowed";

const variants: Record<Variant, string> = {
  primary: "h-control rounded-control bg-brand px-7 text-surface hover:bg-brand-hover",
  secondary: "h-control rounded-control border border-brand bg-surface px-7 text-brand hover:border-brand-hover hover:text-brand-hover",
  text: "text-brand hover:text-brand-hover",
};

export function Button(props: ButtonProps | LinkProps) {
  const { variant = "secondary", arrow, icon: Icon, fullWidth, className, children } = props;
  const classes = cx(base, variants[variant], fullWidth && "w-full", className);
  const content = (
    <>
      {Icon && <Icon size={22} strokeWidth={ICON_STROKE} aria-hidden />}
      <span>{children}</span>
      {arrow && <ArrowRight size={22} strokeWidth={ICON_STROKE} aria-hidden />}
    </>
  );

  if (props.href !== undefined) {
    return (
      <Link href={props.href} prefetch={props.prefetch} className={classes}>
        {content}
      </Link>
    );
  }

  const { variant: _v, arrow: _a, icon: _i, fullWidth: _f, className: _c, children: _ch, type, ...rest } = props as ButtonProps;
  return (
    <button type={type ?? "button"} className={classes} {...rest}>
      {content}
    </button>
  );
}
