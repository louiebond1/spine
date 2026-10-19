import Link from "next/link";
import { ArrowRight, type LucideIcon } from "lucide-react";
import { cx } from "@/lib/cx";
import { ICON_STROKE } from "./icons";

type Variant = "primary" | "secondary" | "ghost" | "text" | "danger";

type CommonProps = {
  variant?: Variant;
  size?: "md" | "sm";
  arrow?: boolean;
  icon?: LucideIcon;
  fullWidth?: boolean;
  className?: string;
  children: React.ReactNode;
};

type ButtonProps = CommonProps & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "className" | "children"> & { href?: undefined };
type LinkProps = CommonProps & { href: string; prefetch?: boolean };

const base =
  "inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:opacity-60";

const sizes = { md: "h-control rounded-control px-4 text-meta", sm: "h-8 rounded-control px-3 text-label" };

const variants: Record<Variant, string> = {
  primary: "bg-brand text-on-brand hover:bg-brand-hover",
  secondary: "border border-border-strong bg-surface text-text hover:border-text-faint hover:bg-subtle",
  ghost: "text-text-muted hover:bg-subtle hover:text-text",
  danger: "border border-border-strong bg-surface text-critical hover:bg-critical-soft",
  text: "text-brand hover:text-brand-hover",
};

/** One primary button per screen, for the single most important action. */
export function Button(props: ButtonProps | LinkProps) {
  const { variant = "secondary", size = "md", arrow, icon: Icon, fullWidth, className, children } = props;
  const classes = cx(base, variant !== "text" && sizes[size], variant === "text" && "text-meta", variants[variant], fullWidth && "w-full", className);
  const content = (
    <>
      {Icon && <Icon size={size === "sm" ? 15 : 16} strokeWidth={ICON_STROKE} aria-hidden />}
      <span>{children}</span>
      {arrow && <ArrowRight size={16} strokeWidth={ICON_STROKE} aria-hidden />}
    </>
  );
  if (props.href !== undefined) {
    return (
      <Link href={props.href} prefetch={props.prefetch} className={classes}>
        {content}
      </Link>
    );
  }
  const { variant: _v, size: _s, arrow: _a, icon: _i, fullWidth: _f, className: _c, children: _ch, type, ...rest } = props as ButtonProps;
  return (
    <button type={type ?? "button"} className={classes} {...rest}>
      {content}
    </button>
  );
}
