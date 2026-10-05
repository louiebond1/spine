import { cx } from "@/lib/cx";

export type TimelineItem = { key: string; text: React.ReactNode; time?: string };

/** Dot timeline: brand dots for the question History panel, muted dots elsewhere. */
export function Timeline({ items, tone = "muted" }: { items: TimelineItem[]; tone?: "brand" | "muted" }) {
  return (
    <ol className="relative">
      {items.map((item, i) => (
        <li key={item.key} className="relative flex gap-5 pb-6 last:pb-0">
          {i < items.length - 1 && <span className="absolute left-1 top-3 h-full w-px bg-border" aria-hidden />}
          <span className={cx("relative mt-2 h-3 w-3 shrink-0 rounded-full", tone === "brand" ? "bg-brand" : "bg-text-muted")} aria-hidden />
          <div>
            <p className={cx("text-meta", tone === "brand" ? "text-text-muted" : "text-text")}>{item.text}</p>
            {item.time && <p className="text-meta text-text-muted">{item.time}</p>}
          </div>
        </li>
      ))}
    </ol>
  );
}
