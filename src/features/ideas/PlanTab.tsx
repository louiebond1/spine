"use client";

import { useState, useTransition } from "react";
import { ArrowDown, ArrowUp, ChevronRight } from "lucide-react";
import { cx } from "@/lib/cx";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { TextField } from "@/components/ui/TextField";
import { Select } from "@/components/ui/Select";
import { NumberField } from "@/components/ui/NumberField";
import { ErrorState, SkeletonRows, EmptyState } from "@/components/ui/States";
import { controlClass } from "@/components/ui/Field";
import { ICON_STROKE } from "@/components/ui/icons";
import { addStep, editStep, logHoursSaved, moveStep, retryBuildPlan, toggleStep } from "@/server/projects/actions";

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
  hours: { show: boolean; canLog: boolean; value: number };
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
      <div className="min-w-64 flex-1">
        <TextField aria-label="Step" value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} placeholder="Describe the step" autoFocus />
      </div>
      <div className="w-56">
        <Select aria-label="Assignee" value={v.assigneeId} onChange={(e) => setV({ ...v, assigneeId: e.target.value })} options={team.map((m) => ({ value: m.id, label: m.name }))} />
      </div>
      <input type="date" aria-label="Due date" value={v.dueDate} onChange={(e) => setV({ ...v, dueDate: e.target.value })} className={cx(controlClass, "w-48")} />
      <Button type="submit" disabled={pending}>
        Save
      </Button>
      <Button variant="text" onClick={onCancel}>
        Cancel
      </Button>
      {error && <p className="w-full text-label text-text-muted">{error}</p>}
    </form>
  );
}

function StepRow({ step, team, canEdit, first, last }: { step: PlanStepView; team: Props["team"]; canEdit: boolean; first: boolean; last: boolean }) {
  const [editing, setEditing] = useState(false);
  const [pending, start] = useTransition();

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
    <div className="group flex items-center gap-6 py-4">
      <Checkbox
        aria-label={step.done ? `Reopen ${step.title}` : `Complete ${step.title}`}
        checked={step.done}
        disabled={!canEdit || pending}
        onChange={(e) => start(() => toggleStep(step.id, e.target.checked))}
      />
      {canEdit ? (
        <button type="button" onClick={() => setEditing(true)} className="w-step-title truncate text-left text-meta text-text hover:text-brand">
          {step.title}
        </button>
      ) : (
        <span className="w-step-title truncate text-meta text-text">{step.title}</span>
      )}
      <Avatar initials={step.assigneeInitials} size="sm" />
      <span className="flex-1 text-meta text-text-muted">{step.dueLabel}</span>
      {canEdit && !step.done && (
        <span className="flex gap-2 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
          <button type="button" aria-label="Move up" disabled={first || pending} onClick={() => start(() => moveStep(step.id, "up"))} className="text-text-muted hover:text-brand disabled:opacity-30">
            <ArrowUp size={18} strokeWidth={ICON_STROKE} />
          </button>
          <button type="button" aria-label="Move down" disabled={last || pending} onClick={() => start(() => moveStep(step.id, "down"))} className="text-text-muted hover:text-brand disabled:opacity-30">
            <ArrowDown size={18} strokeWidth={ICON_STROKE} />
          </button>
        </span>
      )}
    </div>
  );
}

function HoursRow({ projectId, value, canLog }: { projectId: string; value: number; canLog: boolean }) {
  const [hours, setHours] = useState(String(value));
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="flex items-center gap-5 py-4">
      <span className="flex-1 text-meta text-text">Hours saved this month</span>
      <NumberField aria-label="Hours saved this month" min={0} value={hours} onChange={(e) => setHours(e.target.value)} disabled={!canLog} />
      {canLog && (
        <Button
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await logHoursSaved(projectId, Number(hours));
              setError(r.error ?? null);
            })
          }
        >
          Save
        </Button>
      )}
      {error && <p className="text-label text-text-muted">{error}</p>}
    </div>
  );
}

export function PlanTab({ projectId, steps, team, canEdit, planStatus, stage, hours, defaultDue }: Props) {
  const [adding, setAdding] = useState(false);
  const [showDone, setShowDone] = useState(false);
  const [retrying, start] = useTransition();
  const open = steps.filter((s) => !s.done);
  const done = steps.filter((s) => s.done);
  const building = stage === "BUILDING";
  const generated = steps.some((s) => s.generatedFromBrief);

  if (building && planStatus === "GENERATING" && steps.length === 0)
    return (
      <section className="rounded-container border border-border bg-surface px-6">
        <SkeletonRows count={4} leading={false} />
      </section>
    );

  return (
    <section className="rounded-container border border-border bg-surface px-6 pb-5">
      {hours.show && <HoursRow projectId={projectId} value={hours.value} canLog={hours.canLog} />}
      {generated && <p className="border-b border-border py-4 text-right text-label text-text-muted">Generated from project brief</p>}
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
            <button type="button" onClick={() => setAdding(true)} className="py-3 text-meta font-medium text-brand hover:text-brand-hover">
              + Add step
            </button>
          )}
        </div>
      )}

      {done.length > 0 && (
        <div className="mt-3 rounded-control bg-neutral-soft">
          <button type="button" onClick={() => setShowDone(!showDone)} aria-expanded={showDone} className="flex w-full items-center gap-4 px-5 py-4 text-left text-meta font-medium text-text-muted">
            <ChevronRight size={20} strokeWidth={ICON_STROKE} className={cx("transition-transform", showDone && "rotate-90")} aria-hidden />
            {done.length} completed {done.length === 1 ? "step" : "steps"}
          </button>
          {showDone && (
            <div className="divide-y divide-border px-5 pb-2">
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
