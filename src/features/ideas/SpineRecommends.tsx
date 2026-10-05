"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ICON_STROKE } from "@/components/ui/icons";
import { applyRecommendation, dismissRecommendation, refreshProjectRecommendations, undoRecommendation } from "@/server/autopilot/actions";

export type RecommendationView = {
  id: string;
  headline: string;
  reason: string;
  status: "OPEN" | "APPLIED";
  canApply: boolean;
  canUndo: boolean;
  appliedBy: string | null;
};

export function RecRow({ rec, context }: { rec: RecommendationView; context?: React.ReactNode }) {
  const [pending, start] = useTransition();
  const [note, setNote] = useState<string | null>(null);
  const router = useRouter();

  const run = (fn: () => Promise<{ ok: boolean; message: string } | void>) =>
    start(async () => {
      const r = await fn();
      if (r) setNote(r.message);
      router.refresh();
    });

  return (
    <div className="flex items-start gap-5 py-4">
      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand" aria-hidden>
        {rec.status === "APPLIED" ? <Check size={14} strokeWidth={2} /> : <Sparkles size={14} strokeWidth={ICON_STROKE} />}
      </span>
      <div className="min-w-0 flex-1">
        {context}
        <p className="text-row-title font-medium text-text">{rec.headline}</p>
        <p className="mt-1 text-meta text-text-muted">{rec.status === "APPLIED" ? `Done${rec.appliedBy ? ` by ${rec.appliedBy}` : ""}.` : rec.reason}</p>
        {note && <p className="mt-1 text-label text-text-muted">{note}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-4">
        {rec.status === "OPEN" && rec.canApply && (
          <>
            <Button variant="text" disabled={pending} onClick={() => run(() => dismissRecommendation(rec.id))}>
              Not now
            </Button>
            <Button disabled={pending} onClick={() => run(() => applyRecommendation(rec.id))}>
              Do it
            </Button>
          </>
        )}
        {rec.status === "APPLIED" && rec.canUndo && (
          <Button variant="text" disabled={pending} onClick={() => run(() => undoRecommendation(rec.id))}>
            Undo
          </Button>
        )}
      </div>
    </div>
  );
}

/** Spine Autopilot on a project: measured, actionable fixes with one-click apply and undo. */
export function SpineRecommends({ projectId, recs }: { projectId: string; recs: RecommendationView[] }) {
  const router = useRouter();
  const asked = useRef(false);

  // Recompute only when the project has changed since the last recommendations.
  useEffect(() => {
    if (asked.current) return;
    asked.current = true;
    refreshProjectRecommendations(projectId)
      .then((r) => r.refreshed && router.refresh())
      .catch(() => {});
  }, [projectId, router]);

  if (recs.length === 0) return null;
  return (
    <section className="mb-6 rounded-container border border-border bg-surface px-6">
      <header className="flex items-center justify-between border-b border-border py-3">
        <p className="flex items-center gap-2 text-label font-semibold text-brand">
          <Sparkles size={14} strokeWidth={ICON_STROKE} aria-hidden />
          Spine recommends
        </p>
        <p className="text-tiny text-text-muted">Measured from this project&apos;s pace, plan and team. Every change can be undone.</p>
      </header>
      <div className="divide-y divide-border">
        {recs.map((r) => (
          <RecRow key={r.id} rec={r} />
        ))}
      </div>
    </section>
  );
}
