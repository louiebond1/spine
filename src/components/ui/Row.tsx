import Link from "next/link";
import { cx } from "@/lib/cx";

type Props = {
  leading?: React.ReactNode;
  title: React.ReactNode;
  meta?: React.ReactNode;
  trailing?: React.ReactNode;
  href?: string;
  /** "You" row on the Leaderboard. */
  highlighted?: boolean;
  /** Small rows (Your work, plan steps) use less vertical padding. */
  density?: "comfortable" | "compact";
  /** Space between the leading tile or avatar and the text. */
  gap?: "normal" | "wide";
  className?: string;
};

export function Row({ leading, title, meta, trailing, href, highlighted, density = "comfortable", gap = "normal", className }: Props) {
  const body = (
    <div className="min-w-0 flex-1">
      <div className="truncate text-row-title font-medium text-text">{title}</div>
      {meta && <div className="mt-1">{meta}</div>}
    </div>
  );
  return (
    <div
      className={cx(
        "flex items-center",
        gap === "wide" ? "gap-6" : "gap-5",
        density === "comfortable" ? "py-5" : "py-3",
        highlighted && "-mx-3 rounded-control bg-brand-soft px-3",
        className,
      )}
    >
      {leading}
      {href ? (
        <Link href={href} className="min-w-0 flex-1">
          {body}
        </Link>
      ) : (
        body
      )}
      {trailing && <div className="flex shrink-0 items-center gap-6">{trailing}</div>}
    </div>
  );
}
