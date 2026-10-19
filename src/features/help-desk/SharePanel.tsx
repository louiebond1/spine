"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/States";
import { controlClass } from "@/components/ui/Field";
import { cx } from "@/lib/cx";
import { shareAnswer, suggestShare, unshareAnswer } from "@/server/questions/actions";

/**
 * Turning a private answer into company knowledge. The Champion can draft a short summary;
 * only the asker can publish it. Only the summary is shared: never the conversation or files.
 */
export function SharePanel({
  questionId,
  summary,
  sharedAt,
  canShare,
  canSuggest,
}: {
  questionId: string;
  summary: string | null;
  sharedAt: Date | null;
  canShare: boolean;
  canSuggest: boolean;
}) {
  const router = useRouter();
  const [text, setText] = useState(summary ?? "");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (sharedAt) {
    return (
      <Notice tone="positive">
        The answer summary is shared with your company.{" "}
        {canShare && (
          <button type="button" className="font-medium text-text underline" disabled={pending} onClick={() => start(async () => { await unshareAnswer(questionId); router.refresh(); })}>
            Stop sharing
          </button>
        )}
      </Notice>
    );
  }
  if (!canShare && !canSuggest) return null;
  if (canSuggest && summary && !canShare) return <Notice>You suggested sharing a summary. The asker decides.</Notice>;

  const submit = () =>
    start(async () => {
      setError(null);
      const r = canShare ? await shareAnswer(questionId, text) : await suggestShare(questionId, text);
      if (!r.ok) setError(r.error);
      else {
        setDone(canShare ? "Shared." : "Sent to the asker.");
        router.refresh();
      }
    });

  return (
    <section className="rounded-container border border-border bg-surface p-4">
      <h2 className="text-meta font-semibold text-text">{canShare ? (summary ? "Your Champion suggested sharing this answer" : "Share the answer with your company?") : "Suggest sharing the answer"}</h2>
      <p className="mt-0.5 text-label text-text-muted">
        {canShare
          ? "Only this summary becomes visible to colleagues and to Spine's suggested answers. The conversation and files stay private. Leave out names and client details."
          : "Write a short, name-free summary. The asker reviews it and decides whether to share it."}
      </p>
      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={4} className={cx(controlClass, "mt-3 h-auto w-full py-2")} aria-label="Answer summary" maxLength={2000} />
      {error && <p className="mt-2 text-label text-critical">{error}</p>}
      {done && <p className="mt-2 text-label text-positive">{done}</p>}
      <div className="mt-3 flex justify-end">
        <Button size="sm" onClick={submit} disabled={pending || text.trim().length < 20}>
          {canShare ? "Share summary" : "Send to the asker"}
        </Button>
      </div>
    </section>
  );
}
