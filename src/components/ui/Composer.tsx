"use client";

import { useRef, useState, useTransition } from "react";
import { Paperclip, X } from "lucide-react";
import { Button } from "./Button";
import { controlClass } from "./Field";
import { ICON_STROKE } from "./icons";

type Props = { onSend: (data: FormData) => Promise<void>; allowAttach?: boolean; trailing?: React.ReactNode; placeholder?: string };

export function Composer({ onSend, allowAttach, trailing, placeholder = "Write a reply..." }: Props) {
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
    <div className="rounded-container border border-border bg-surface p-2.5">
      {files.length > 0 && (
        <ul className="mb-2 flex flex-wrap gap-2">
          {files.map((f, i) => (
            <li key={i} className="flex items-center gap-1.5 rounded-control bg-subtle px-2 py-1 text-label text-text">
              {f.name}
              <button type="button" aria-label={`Remove ${f.name}`} onClick={() => setFiles(files.filter((_, j) => j !== i))}>
                <X size={13} strokeWidth={ICON_STROKE} />
              </button>
            </li>
          ))}
        </ul>
      )}
      <form ref={form} action={submit} className="flex flex-wrap items-center gap-2">
        {allowAttach && (
          <>
            <button type="button" onClick={() => fileInput.current?.click()} className="flex h-control w-control shrink-0 items-center justify-center rounded-control text-text-muted hover:bg-subtle hover:text-text" aria-label="Attach a file">
              <Paperclip size={16} strokeWidth={ICON_STROKE} />
            </button>
            <input ref={fileInput} type="file" multiple hidden onChange={(e) => setFiles([...files, ...Array.from(e.target.files ?? [])])} />
          </>
        )}
        <input name="body" placeholder={placeholder} className={controlClass + " min-w-0 flex-1 border-transparent focus:ring-0"} autoComplete="off" disabled={pending} aria-label="Message" />
        <div className="flex items-center gap-2">
          <Button type="submit" variant="primary" size="sm" disabled={pending}>
            Send
          </Button>
          {trailing}
        </div>
      </form>
      {error && <p className="mt-2 text-label text-critical">Your message couldn't be sent. Try again.</p>}
    </div>
  );
}
