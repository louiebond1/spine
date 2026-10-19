import Link from "next/link";
import { ArrowLeft, ChevronRight } from "lucide-react";
import { ICON_STROKE } from "./icons";

type Props = {
  date?: string;
  title: React.ReactNode;
  /** One short grey line that explains the page through what it does, not marketing. */
  subtitle?: React.ReactNode;
  eyebrow?: string;
  back?: { href: string; label: string };
  breadcrumb?: { href: string; label: string }[];
  meta?: React.ReactNode;
  aside?: React.ReactNode;
  size?: "page" | "home";
};

export function PageHeader({ date, title, subtitle, eyebrow, back, breadcrumb, meta, aside, size = "page" }: Props) {
  return (
    <header className="mb-6">
      {back && (
        <Link href={back.href} className="mb-3 inline-flex items-center gap-1.5 text-label text-text-muted hover:text-text">
          <ArrowLeft size={14} strokeWidth={ICON_STROKE} aria-hidden />
          {back.label}
        </Link>
      )}
      {breadcrumb && (
        <nav className="mb-2 flex flex-wrap items-center gap-1.5 text-label text-text-muted" aria-label="Breadcrumb">
          {breadcrumb.map((c, i) => (
            <span key={c.href} className="flex items-center gap-1.5">
              {i > 0 && <ChevronRight size={13} strokeWidth={ICON_STROKE} aria-hidden />}
              <Link href={c.href} className="hover:text-text">
                {c.label}
              </Link>
            </span>
          ))}
        </nav>
      )}
      {date && <p className="mb-1 text-label text-text-muted">{date}</p>}
      {eyebrow && <p className="mb-1 text-eyebrow font-semibold uppercase text-text-faint">{eyebrow}</p>}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <h1 className={size === "home" ? "text-headline font-semibold text-text" : "text-title font-semibold text-text"}>{title}</h1>
        {aside && <div className="flex shrink-0 items-center gap-2">{aside}</div>}
      </div>
      {subtitle && <p className="mt-1.5 max-w-prose text-meta text-text-muted">{subtitle}</p>}
      {meta && <div className="mt-2">{meta}</div>}
    </header>
  );
}
