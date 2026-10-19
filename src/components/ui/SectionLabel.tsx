import { cx } from "@/lib/cx";

/** Small uppercase label for groups inside a page. */
export function SectionLabel({ children, className }: { children: React.ReactNode; className?: string }) {
  return <p className={cx("text-eyebrow font-semibold uppercase text-text-faint", className)}>{children}</p>;
}
