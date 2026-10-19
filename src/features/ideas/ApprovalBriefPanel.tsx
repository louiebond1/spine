"use client";

import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { ICON_STROKE } from "@/components/ui/icons";
import { getApprovalBrief, type ApprovalBrief } from "@/server/approvals/brief";

/** Spine's neutral approval brief: what's asked, why it's worth it, what to check, what to ask. */
export function ApprovalBriefPanel({ projectId }: { projectId: string }) {
  const [brief, setBrief] = useState<ApprovalBrief | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let live = true;
    setError(null);
    getApprovalBrief(projectId)
      .then((r) => {
        if (!live) return;
        if (r.ok) setBrief(r.brief);
        else setError(r.error);
      })
      .catch(() => live && setError("Spine couldn't write the brief just now."));
    return () => {
      live = false;
    };
  }, [projectId, attempt]);

  return (
    <section className="rounded-container border border-border bg-surface p-4 sm:p-5">
      <p className="flex items-center gap-1.5 text-label font-medium text-text-muted">
        <Sparkles size={13} strokeWidth={ICON_STROKE} aria-hidden />
        Approval brief
      </p>
      {error ? (
        <p className="mt-3 text-meta text-text-muted">
          {error}{" "}
          <button type="button" className="text-brand hover:text-brand-hover" onClick={() => setAttempt((a) => a + 1)}>
            Try again
          </button>
        </p>
      ) : !brief ? (
        <div className="mt-3 space-y-3" aria-busy="true" aria-label="Writing the brief">
          <span className="block h-4 w-3/4 animate-pulse rounded-sm bg-subtle" />
          <span className="block h-4 w-1/2 animate-pulse rounded-sm bg-subtle" />
        </div>
      ) : (
        <>
          <p className="mt-3 text-meta text-text">{brief.summary}</p>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            {(
              [
                ["Worth doing because", brief.strengths],
                ["Check before approving", brief.watchOuts],
                ["Ask the owner", brief.questions],
              ] as const
            ).map(([label, items]) => (
              <div key={label}>
                <SectionLabel>{label}</SectionLabel>
                <ul className="mt-2 space-y-2">
                  {items.map((x) => (
                    <li key={x} className="text-meta text-text">
                      {x}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <p className="mt-4 text-tiny text-text-muted">Drafted by AI from the idea, your company's priorities and what's already in flight. It never includes the owner's AI scores.</p>
        </>
      )}
    </section>
  );
}
