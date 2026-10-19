"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ErrorState, SkeletonRows } from "@/components/ui/States";
import { runDraftPlan } from "@/server/projects/actions";

export type DraftStepView = { id: string; title: string };

/** "Suggested plan": Claude's draft steps, written as soon as the idea is proposed. */
export function DraftPlan({ projectId, steps, canGenerate }: { projectId: string; steps: DraftStepView[]; canGenerate: boolean }) {
  const router = useRouter();
  const [failed, setFailed] = useState<string | null>(null);
  const started = useRef(false);

  const run = useCallback(() => {
    setFailed(null);
    runDraftPlan(projectId)
      .then((r) => (r.ok ? router.refresh() : setFailed(r.error)))
      .catch(() => setFailed("The suggested plan couldn't be written."));
  }, [projectId, router]);

  useEffect(() => {
    if (steps.length || !canGenerate || started.current) return;
    started.current = true;
    run();
  }, [steps.length, canGenerate, run]);

  return (
    <section className="rounded-container border border-border bg-surface px-4 sm:px-5">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border py-3">
        <h2 className="text-section font-semibold text-text">Suggested plan</h2>
        <p className="text-label text-text-muted">Assigned to the team once it&apos;s complete</p>
      </div>
      {steps.length > 0 ? (
        <ol className="divide-y divide-border">
          {steps.map((s, i) => (
            <li key={s.id} className="flex gap-3 py-2.5">
              <span className="w-5 text-label text-text-faint">{i + 1}</span>
              <span className="text-meta text-text">{s.title}</span>
            </li>
          ))}
        </ol>
      ) : failed ? (
        <ErrorState message={failed} onRetry={run} />
      ) : canGenerate ? (
        <SkeletonRows count={4} leading={false} />
      ) : (
        <p className="py-5 text-meta text-text-muted">The plan is written once the team is complete.</p>
      )}
    </section>
  );
}
