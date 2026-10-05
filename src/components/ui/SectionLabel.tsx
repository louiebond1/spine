import { cx } from "@/lib/cx";

/** Uppercase section label: "THE IDEA", "RECENT WINS". */
export function SectionLabel({ children, className }: { children: React.ReactNode; className?: string }) {
  return <p className={cx("text-eyebrow font-semibold uppercase text-text-muted", className)}>{children}</p>;
}
