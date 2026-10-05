import { FileSpreadsheet, FileText } from "lucide-react";
import { cx } from "@/lib/cx";
import { Avatar } from "./Avatar";
import { ICON_STROKE } from "./icons";

export type ChatAttachment = { id: string; fileName: string; size: string; href: string };

type Props = {
  author: string;
  initials: string | null;
  time: string;
  body?: string;
  mine?: boolean;
  attachments?: ChatAttachment[];
  /** System messages are small grey text with no bubble. */
  system?: boolean;
};

export function ChatMessage({ author, initials, time, body, mine, attachments = [], system }: Props) {
  if (system) return <p className="py-2 pl-20 text-label text-text-muted">{body}</p>;
  return (
    <div className="flex gap-6">
      <Avatar initials={initials} />
      <div className="min-w-0 flex-1">
        <p className="mb-2 flex items-baseline gap-4">
          <span className="text-label font-semibold text-text">{author}</span>
          <span className="text-label text-text-muted">{time}</span>
        </p>
        <div className={cx("inline-block max-w-3xl rounded-container px-5 py-4", mine ? "bg-brand-soft" : "bg-neutral-soft")}>
          {body && <p className="whitespace-pre-line text-meta text-text">{body}</p>}
          {attachments.map((a) => {
            const Icon = /\.(xlsx?|csv)$/i.test(a.fileName) ? FileSpreadsheet : FileText;
            return (
              <a key={a.id} href={a.href} className="mt-4 flex w-96 max-w-full items-center gap-4 rounded-control bg-surface px-4 py-3 hover:text-brand">
                <Icon size={30} strokeWidth={ICON_STROKE} className="shrink-0 text-text" aria-hidden />
                <span className="min-w-0">
                  <span className="block truncate text-label text-text">{a.fileName}</span>
                  <span className="block text-label text-text-muted">{a.size}</span>
                </span>
              </a>
            );
          })}
        </div>
      </div>
    </div>
  );
}
