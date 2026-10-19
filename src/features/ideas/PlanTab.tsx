"use client";

import { useOptimistic, useState, useTransition } from "react";
import { ArrowDown, ArrowUp, ChevronRight } from "lucide-react";
import { cx } from "@/lib/cx";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { TextField } from "@/components/ui/TextField";
import { Select } from "@/components/ui/Select";
import { ErrorState, SkeletonRows, EmptyState } from "@/components/ui/States";
import { controlClass } from "@/components/ui/Field";
import { ICON_STROKE } from "@/components/ui/icons";
import { MeetingNotes } from "./MeetingNotes";
import { addStep, editStep, moveStep, retryBuildPlan, toggleStep } from "@/server/projects/actions";

export type PlanStepView = {
  id: string;
  title: string;
  done: boolean;
  assigneeId: string;
  assigneeInitials: string;
  dueLabel: string;
  /** yyyy-mm-dd */
  dueIso: string;
  generatedFromBrief: boolean;
};

type Props = {
  projectId: string;
  steps: PlanStepView[];
  team: { id: string; name: string }[];
  canEdit: boolean;
  planStatus: "NONE" | "GENERATING" | "READY" | "FAILED";
  stage: string;
  /** Default due date for a new step (yyyy-mm-dd). */
  defaultDue: string;
};

function StepForm({
  team,
  initial,
  onSubmit,
  onCancel,
}: {
  team: Props["team"];
  initial: { title: string; assigneeId: string; dueDate: string };
  onSubmit: (v: { title: string; assigneeId: string; dueDate: string }) => Promise<{ error?: string } | void>;
  onCancel: () => void;
}) {
  const [v, setV] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <form
      className="flex flex-wrap items-center gap-3 py-3"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await onSubmit(v);
          if (r?.error) setError(r.error);
        });
      }}
    >
      <div className="w-full min-w-0 sm:flex-1">
        <TextField aria-label="Step" value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} placeholder="Describe the step" autoFocus />
      </div>
      <div className="w-full sm:w-48">
        <Select aria-label="Assignee" value={v.assigneeId} onChange={(e) => setV({ ...v, assigneeId: e.target.value })} options={team.map((m) => ({ value: m.id, label: m.name }))} />
      </div>
      <input type="date" aria-label="Due date" value={v.dueDate} onChange={(e) => setV({ ...v, dueDate: e.target.value })} className={cx(controlClass, "w-full sm:w-40")} />
      <Button type="submit" size="sm" disabled={pending}>
        Save
      </Button>
      <Button variant="text" onClick={onCancel}>
        Cancel
      </Button>
      {error && <p className="w-full text-label text-critical">{error}</p>}
    </form>
  );
}

function StepRow({ step, team, canEdit, first, last }: { step: PlanStepView; team: Props["team"]; canEdit: boolean; first: boolean; last: boolean }) {
  const [editing, setEditing] = useState(false);
  const [pending, start] = useTransition();
  const [done, setDone] = useOptimistic(step.done);

  if (editing)
    return (
      <StepForm
        team={team}
        initial={{ title: step.title, assigneeId: step.assigneeId, dueDate: step.dueIso }}
        onSubmit={async (v) => {
          const r = await editStep(step.id, v);
          if (!r.error) setEditing(false);
          return r;
        }}
        onCancel={() => setEditing(false)}
      />
    );

  return (
    <div className="group flex items-center gap-3 py-3">
      <Checkbox
        aria-label={done ? `Reopen ${step.title}` : `Complete ${step.title}`}
        checked={done}
        disabled={!canEdit || pending}
        onChange={(e) => {
          const next = e.target.checked;
          start(async () => {
            setDone(next);
            await toggleStep(step.id, next);
          });
        }}
      />
      {canEdit ? (
        <button type="button" onClick={() => setEditing(true)} className={cx("min-w-0 flex-1 truncate text-left text-meta hover:text-brand", done ? "text-text-muted line-through" : "text-text")}>
          {step.title}
        </button>
      ) : (
        <span className={cx("min-w-0 flex-1 truncate text-meta", done ? "text-text-muted line-through" : "text-text")}>{step.title}</span>
      )}
      <Avatar initials={step.assigneeInitials} size="sm" />
      <span className="w-16 shrink-0 text-right text-label text-text-muted">{step.dueLabel}</span>
      {canEdit && !step.done && (
        <span className="flex gap-2 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
          <button type="button" aria-label="Move up" disabled={first || pending} onClick={() => start(() => moveStep(step.id, "up"))} className="text-text-muted hover:text-brand disabled:opacity-30">
            <ArrowUp size={16} strokeWidth={ICON_STROKE} />
          </button>
          <button type="button" aria-label="Move down" disabled={last || pending} onClick={() => start(() => moveStep(step.id, "down"))} className="text-text-muted hover:text-brand disabled:opacity-30">
            <ArrowDown size={16} strokeWidth={ICON_STROKE} />
          </button>
        </span>
      )}
    </div>
  );
}

export function PlanTab({ projectId, steps, team, canEdit, planStatus, stage, defaultDue }: Props) {
  const [adding, setAdding] = useState(false);
  const [showDone, setShowDone] = useState(false);
  const [retrying, start] = useTransition();
  const open = steps.filter((s) => !s.done);
  const done = steps.filter((s) => s.done);
  const building = stage === "BUILDING";
  const generated = steps.some((s) => s.generatedFromBrief);

  if (building && planStatus === "GENERATING" && steps.length === 0)
    return (
      <section className="rounded-container border border-border bg-surface px-4 sm:px-5">
        <SkeletonRows count={4} leading={false} />
      </section>
    );

  return (
    <section className="rounded-container border border-border bg-surface px-4 pb-4 sm:px-5">
      {generated && <p className="border-b border-border py-2.5 text-right text-tiny text-text-faint">First drafted by AI from the brief</p>}
      {building && planStatus === "FAILED" && steps.length === 0 && (
        <ErrorState message="The build plan couldn't be generated." onRetry={() => start(() => retryBuildPlan(projectId))} />
      )}
      {retrying && <SkeletonRows count={2} leading={false} />}
      {steps.length === 0 && planStatus !== "FAILED" && !building && <EmptyState>The build plan is written when the team is complete.</EmptyState>}

      <div className="divide-y divide-border border-b border-border">
        {open.map((s, i) => (
          <StepRow key={s.id} step={s} team={team} canEdit={canEdit && building} first={i === 0} last={i === open.length - 1} />
        ))}
      </div>

      {canEdit && building && (
        <div className="pt-2">
          {adding ? (
            <StepForm
              team={team}
              initial={{ title: "", assigneeId: team[0]?.id ?? "", dueDate: defaultDue }}
              onSubmit={async (v) => {
                const r = await addStep(projectId, v);
                if (!r.error) setAdding(false);
                return r;
              }}
              onCancel={() => setAdding(false)}
            />
          ) : (
            <div className="flex flex-wrap items-center gap-x-6">
              <button type="button" onClick={() => setAdding(true)} className="py-2.5 text-meta font-medium text-brand hover:text-brand-hover">
                + Add step
              </button>
              <MeetingNotes projectId={projectId} />
            </div>
          )}
        </div>
      )}

      {done.length > 0 && (
        <div className="mt-3 rounded-control bg-subtle">
          <button type="button" onClick={() => setShowDone(!showDone)} aria-expanded={showDone} className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-label font-medium text-text-muted">
            <ChevronRight size={16} strokeWidth={ICON_STROKE} className={cx("transition-transform", showDone && "rotate-90")} aria-hidden />
            {done.length} completed {done.length === 1 ? "step" : "steps"}
          </button>
          {showDone && (
            <div className="divide-y divide-border px-3 pb-1">
              {done.map((s) => (
                <StepRow key={s.id} step={s} team={team} canEdit={canEdit && building} first last />
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
