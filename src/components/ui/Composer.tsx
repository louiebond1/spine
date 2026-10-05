"use client";

import { useRef, useState, useTransition } from "react";
import { Paperclip, Send, X } from "lucide-react";
import { Button } from "./Button";
import { controlClass } from "./Field";
import { ICON_STROKE } from "./icons";

type Props = {
  /** Receives a FormData with "body" and, if allowAttach, "files". */
  onSend: (data: FormData) => Promise<void>;
  allowAttach?: boolean;
  /** Extra action after Send, e.g. the secondary "Mark resolved". */
  trailing?: React.ReactNode;
  placeholder?: string;
};

export function Composer({ onSend, allowAttach, trailing, placeholder = "Type a message..." }: Props) {
  const form = useRef<HTMLFormElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [pending, start] = useTransition();
  const [error, setError] = useState(false);

  const submit = (data: FormData) => {
    const body = String(data.get("body") ?? "").trim();
    if (!body && files.length === 0) return;
    data.delete("files");
    files.forEach((f) => data.append("files", f));
    start(async () => {
      try {
        setError(false);
        await onSend(data);
        form.current?.reset();
        setFiles([]);
      } catch {
        setError(true);
      }
    });
  };

  return (
    <div className="rounded-container border border-border bg-surface p-4">
      {files.length > 0 && (
        <ul className="mb-3 flex flex-wrap gap-3">
          {files.map((f, i) => (
            <li key={i} className="flex items-center gap-2 rounded-control bg-neutral-soft px-3 py-1 text-label text-text">
              {f.name}
              <button type="button" aria-label={`Remove ${f.name}`} onClick={() => setFiles(files.filter((_, j) => j !== i))}>
                <X size={16} strokeWidth={ICON_STROKE} />
              </button>
            </li>
          ))}
        </ul>
      )}
      <form ref={form} action={submit} className="flex items-center gap-3">
        {allowAttach && (
          <>
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              className="flex h-control w-control shrink-0 items-center justify-center rounded-control border border-border text-text hover:text-brand"
              aria-label="Attach a file"
            >
              <Paperclip size={22} strokeWidth={ICON_STROKE} />
            </button>
            <input
              ref={fileInput}
              type="file"
              multiple
              hidden
              onChange={(e) => setFiles([...files, ...Array.from(e.target.files ?? [])])}
            />
          </>
        )}
        <input name="body" placeholder={placeholder} className={controlClass + " h-control w-full"} autoComplete="off" disabled={pending} />
        <Button type="submit" variant="primary" icon={Send} disabled={pending}>
          Send
        </Button>
        {trailing}
      </form>
      {error && <p className="mt-3 text-label text-text-muted">Your message couldn&apos;t be sent. Try again.</p>}
    </div>
  );
}
