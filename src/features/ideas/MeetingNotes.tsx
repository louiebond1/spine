"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { NotebookPen } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { Modal } from "@/components/ui/Modal";
import { TextArea } from "@/components/ui/TextArea";
import { ICON_STROKE } from "@/components/ui/icons";
import { applyMeetingChanges, readMeetingNotes, type MeetingChange } from "@/server/ai/meeting";

/** Paste meeting notes; Spine proposes plan updates; tick and apply in one go. */
export function MeetingNotes({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState("");
  const [summary, setSummary] = useState("");
  const [changes, setChanges] = useState<MeetingChange[] | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const close = () => {
    setOpen(false);
    setNotes("");
    setChanges(null);
    setMessage(null);
  };

  const read = () =>
    start(async () => {
      setMessage(null);
      const r = await readMeetingNotes(projectId, notes);
      if (!r.ok) return setMessage(r.error);
      setSummary(r.summary);
      setChanges(r.changes);
      setPicked(new Set(r.changes.map((c) => c.id)));
    });

  const apply = () =>
    start(async () => {
      const chosen = (changes ?? []).filter((c) => picked.has(c.id));
      const r = await applyMeetingChanges(projectId, chosen, summary);
      setMessage(r.message);
      if (r.ok) {
        router.refresh();
        setTimeout(close, 1200);
      }
    });

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="inline-flex items-center gap-2 py-3 text-meta font-medium text-brand hover:text-brand-hover">
        <NotebookPen size={16} strokeWidth={ICON_STROKE} aria-hidden />
        Update from meeting notes
      </button>
      <Modal
        open={open}
        onClose={close}
        title="Update the plan from meeting notes"
        footer={
          changes ? (
            <>
              <Button variant="text" onClick={() => setChanges(null)} disabled={pending}>
                Back
              </Button>
              <Button variant="primary" onClick={apply} disabled={pending || picked.size === 0}>
                Apply {picked.size} {picked.size === 1 ? "change" : "changes"}
              </Button>
            </>
          ) : (
            <Button variant="primary" onClick={read} disabled={pending || notes.trim().length < 20}>
              {pending ? "Reading…" : "Read notes"}
            </Button>
          )
        }
      >
        {!changes ? (
          <>
            <p className="mb-3 text-label text-text-muted">Paste notes or a transcript. Spine works out what was finished, what&apos;s new, who&apos;s doing it and by when.</p>
            <TextArea id="meeting-notes" rows={9} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={"Jamie finished testing the supplier cases.\nMia will fix the two date bugs by Friday.\nSarah to write the how-to guide by 20 Oct."} />
          </>
        ) : changes.length === 0 ? (
          <p className="text-meta text-text-muted">Spine didn&apos;t find any plan changes in those notes. The summary can still be posted.</p>
        ) : (
          <div>
            <p className="mb-3 text-meta text-text">{summary}</p>
            <ul className="divide-y divide-border rounded-control border border-border">
              {changes.map((c) => (
                <li key={c.id} className="px-4 py-3">
                  <Checkbox
                    checked={picked.has(c.id)}
                    onChange={(e) => {
                      const next = new Set(picked);
                      if (e.target.checked) next.add(c.id);
                      else next.delete(c.id);
                      setPicked(next);
                    }}
                    label={<span className="text-meta text-text">{c.label}</span>}
                  />
                  {c.evidence && <p className="mt-1 pl-9 text-tiny text-text-muted">&ldquo;{c.evidence}&rdquo;</p>}
                </li>
              ))}
            </ul>
          </div>
        )}
        {message && <p className="mt-3 text-label text-text-muted">{message}</p>}
      </Modal>
    </>
  );
}
