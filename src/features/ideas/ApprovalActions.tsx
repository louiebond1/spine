"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { TextArea } from "@/components/ui/TextArea";
import { approveIdea, returnIdea } from "@/server/projects/actions";

/** Approve (primary) and Return with note (secondary, opens a modal). */
export function ApprovalActions({ projectId }: { projectId: string }) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const send = () =>
    start(async () => {
      const result = await returnIdea(projectId, note);
      if (result?.error) setError(result.error);
    });

  return (
    <div className="space-y-3">
      <Button variant="primary" fullWidth disabled={pending} onClick={() => start(() => approveIdea(projectId))}>
        Approve
      </Button>
      <Button fullWidth disabled={pending} onClick={() => setOpen(true)}>
        Return with note
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Return with note"
        footer={
          <Button variant="primary" onClick={send} disabled={pending}>
            Return to owner
          </Button>
        }
      >
        <TextArea id="return-note" rows={5} value={note} onChange={(e) => setNote(e.target.value)} placeholder="What should the owner change?" />
        {error && <p className="mt-3 text-label text-text-muted">{error}</p>}
      </Modal>
    </div>
  );
}
