import { cx } from "@/lib/cx";

export type TimelineItem = { key: string; text: React.ReactNode; time?: string };

export function Timeline({ items, tone = "muted" }: { items: TimelineItem[]; tone?: "brand" | "muted" }) {
  return (
    <ol className="relative">
      {items.map((item, i) => (
        <li key={item.key} className="relative flex gap-3 pb-4 last:pb-0">
          {i < items.length - 1 && <span className="absolute left-1 top-3 h-full w-px bg-border" aria-hidden />}
          <span className={cx("relative mt-1.5 h-2 w-2 shrink-0 rounded-full", tone === "brand" ? "bg-brand" : "bg-border-strong")} aria-hidden />
          <div className="min-w-0">
            <p className="text-label text-text">{item.text}</p>
            {item.time && <p className="text-tiny text-text-faint">{item.time}</p>}
          </div>
        </li>
      ))}
    </ol>
  );
}
