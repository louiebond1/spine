import { FileSpreadsheet, FileText } from "lucide-react";
import { cx } from "@/lib/cx";
import { Avatar } from "./Avatar";
import { ICON_STROKE } from "./icons";

export type ChatAttachment = { id: string; fileName: string; size: string; href: string };

type Props = { author: string; initials: string | null; time: string; body?: string; mine?: boolean; attachments?: ChatAttachment[]; system?: boolean };

export function ChatMessage({ author, initials, time, body, mine, attachments = [], system }: Props) {
  if (system) return <p className="py-1 text-label text-text-muted sm:pl-11">{body}</p>;
  return (
    <div className="flex gap-3">
      <Avatar initials={initials} />
      <div className="min-w-0 flex-1">
        <p className="mb-1 flex items-baseline gap-2">
          <span className="text-label font-semibold text-text">{author}</span>
          <span className="text-tiny text-text-faint">{time}</span>
        </p>
        <div className={cx("inline-block max-w-full rounded-container px-3.5 py-2.5", mine ? "bg-brand-soft" : "border border-border bg-surface")}>
          {body && <p className="whitespace-pre-line text-meta text-text">{body}</p>}
          {attachments.map((a) => {
            const Icon = /\.(xlsx?|csv)$/i.test(a.fileName) ? FileSpreadsheet : FileText;
            return (
              <a key={a.id} href={a.href} className="mt-2 flex w-80 max-w-full items-center gap-3 rounded-control border border-border bg-surface px-3 py-2 hover:border-border-strong">
                <Icon size={18} strokeWidth={ICON_STROKE} className="shrink-0 text-text-muted" aria-hidden />
                <span className="min-w-0">
                  <span className="block truncate text-label text-text">{a.fileName}</span>
                  <span className="block text-tiny text-text-muted">{a.size}</span>
                </span>
              </a>
            );
          })}
        </div>
      </div>
    </div>
  );
}
