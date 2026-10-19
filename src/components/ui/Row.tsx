import Link from "next/link";
import { cx } from "@/lib/cx";

type Props = {
  leading?: React.ReactNode;
  title: React.ReactNode;
  meta?: React.ReactNode;
  trailing?: React.ReactNode;
  href?: string;
  highlighted?: boolean;
  density?: "comfortable" | "compact";
  className?: string;
};

/** A list row: optional leading tile, title, one meta line, trailing actions. Stacks on phones. */
export function Row({ leading, title, meta, trailing, href, highlighted, density = "comfortable", className }: Props) {
  const body = (
    <div className="min-w-0 flex-1">
      <div className="truncate text-row-title font-medium text-text">{title}</div>
      {meta && <div className="mt-0.5">{meta}</div>}
    </div>
  );
  return (
    <div
      className={cx(
        "flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4",
        density === "comfortable" ? "py-4" : "py-3",
        highlighted && "-mx-3 rounded-control bg-brand-soft px-3",
        className,
      )}
    >
      <div className="flex min-w-0 flex-1 items-center gap-4">
        {leading}
        {href ? (
          <Link href={href} className="min-w-0 flex-1 hover:opacity-80">
            {body}
          </Link>
        ) : (
          body
        )}
      </div>
      {trailing && <div className="flex shrink-0 items-center gap-3 pl-0 sm:pl-0">{trailing}</div>}
    </div>
  );
}
