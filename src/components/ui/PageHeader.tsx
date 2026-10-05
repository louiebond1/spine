import Link from "next/link";
import { ArrowLeft, ChevronRight } from "lucide-react";
import { ICON_STROKE } from "./icons";

type Props = {
  date?: string;
  title: React.ReactNode;
  /** The one grey line under the headline, only on the all clear Home. */
  subtitle?: string;
  eyebrow?: string;
  back?: { href: string; label: string };
  breadcrumb?: { href: string; label: string }[];
  meta?: React.ReactNode;
  /** Right-aligned control on the headline row (period select). */
  aside?: React.ReactNode;
};

export function PageHeader({ date, title, subtitle, eyebrow, back, breadcrumb, meta, aside }: Props) {
  return (
    <header className={back ? "mb-5" : "mb-8"}>
      {back && (
        <Link href={back.href} className="mb-3 inline-flex items-center gap-2 text-meta text-brand hover:text-brand-hover">
          <ArrowLeft size={20} strokeWidth={ICON_STROKE} aria-hidden />
          {back.label}
        </Link>
      )}
      {breadcrumb && (
        <nav className="mb-3 flex items-center gap-2 text-meta text-text-muted" aria-label="Breadcrumb">
          {breadcrumb.map((c, i) => (
            <span key={c.href} className="flex items-center gap-2">
              {i > 0 && <ChevronRight size={16} strokeWidth={ICON_STROKE} aria-hidden />}
              <Link href={c.href} className="hover:text-text">{c.label}</Link>
            </span>
          ))}
        </nav>
      )}
      {date && <p className="text-date text-text-muted">{date}</p>}
      {eyebrow && <p className="mt-2 text-eyebrow font-semibold uppercase text-text-muted">{eyebrow}</p>}
      <div className="flex items-end justify-between gap-6">
        <h1 className="text-headline font-bold text-text">{title}</h1>
        {aside}
      </div>
      {subtitle && <p className="mt-2 text-meta text-text-muted">{subtitle}</p>}
      {meta && <div className="mt-2">{meta}</div>}
    </header>
  );
}
