"use client";

import { useActionState, useRef, useState, useTransition } from "react";
import { Calendar, Flag, Sparkles, X } from "lucide-react";
import { cx } from "@/lib/cx";
import { Button } from "@/components/ui/Button";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { TextField } from "@/components/ui/TextField";
import { TextArea } from "@/components/ui/TextArea";
import { Select } from "@/components/ui/Select";
import { Field, controlClass } from "@/components/ui/Field";
import { ICON_STROKE } from "@/components/ui/icons";
import { saveDraft, type ProposeState } from "@/server/projects/actions";
import { previewKickoff } from "@/server/ideas/start-actions";
import { AlreadyInFlight } from "./AlreadyInFlight";

export type IdeaDraft = {
  id?: string;
  title: string;
  problem: string;
  whoBenefits: string;
  topicId: string;
  teamSize: number;
  hoursPerWeek: number;
  lengthWeeks: number;
  difficulty: "EASY" | "MODERATE" | "HARD";
  targetDate: string;
  successMetric?: string;
  mvpScope?: string;
  returnNote?: string | null;
  opportunityId?: string;
};

const range = (from: number, to: number, label: (n: number) => string = String) => Array.from({ length: to - from + 1 }, (_, i) => ({ value: String(from + i), label: label(from + i) }));

function formatTarget(value: string) {
  if (!value) return "Choose a date";
  const [y, m, d] = value.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, d!)).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section className="rounded-container border border-border bg-surface p-4 sm:p-5">
      <SectionLabel className="mb-3">{label}</SectionLabel>
      {children}
    </section>
  );
}

/** Describe it in a sentence, let Spine draft the proposal, edit, then continue to the review. */
function DraftFromSentence({ onDraft }: { onDraft: (d: Awaited<ReturnType<typeof previewKickoff>>) => void }) {
  const [text, setText] = useState("");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <section className="rounded-container border border-border bg-surface p-4 sm:p-5">
      <label htmlFor="sentence" className="text-meta font-medium text-text">
        Describe your idea in a sentence
      </label>
      <p className="text-label text-text-muted">Spine drafts the proposal below. Mention who should help and by when if you know.</p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <input
          id="sentence"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="A supplier risk checker with Mia and Ben by December"
          className={cx(controlClass, "min-w-0 flex-1")}
          maxLength={1000}
        />
        <Button
          icon={Sparkles}
          disabled={pending || text.trim().length < 12}
          onClick={() =>
            start(async () => {
              setError(null);
              const r = await previewKickoff(text);
              if (!r.ok) setError(r.error);
              onDraft(r);
            })
          }
        >
          {pending ? "Drafting..." : "Draft it"}
        </Button>
      </div>
      {error && <p className="mt-2 text-label text-text-muted">{error} You can fill in the form yourself.</p>}
    </section>
  );
}

export function ProposeForm({ draft, topics, allowDraft }: { draft: IdeaDraft; topics: { id: string; name: string }[]; allowDraft: boolean }) {
  const [state, action, pending] = useActionState<ProposeState, FormData>(saveDraft, {});
  const [target, setTarget] = useState(draft.targetDate);
  const [idea, setIdea] = useState({ title: draft.title, problem: draft.problem });
  const [invitees, setInvitees] = useState<{ id: string; name: string }[]>([]);
  const [useCases, setUseCases] = useState("");
  const [version, setVersion] = useState(0);
  const [values, setValues] = useState(draft);
  const formRef = useRef<HTMLFormElement>(null);
  const field = (name: string) => formRef.current?.elements.namedItem(name) as HTMLInputElement | null;

  const applyDraft = (r: Awaited<ReturnType<typeof previewKickoff>>) => {
    if (!r.ok) return;
    const b = r.draft.brief;
    setValues({ ...values, title: b.title, problem: b.problem, whoBenefits: b.whoBenefits, topicId: r.draft.topicId || values.topicId, teamSize: b.teamSize, hoursPerWeek: b.hoursPerWeek, lengthWeeks: b.lengthWeeks, difficulty: b.difficulty as IdeaDraft["difficulty"], successMetric: b.successMetric, mvpScope: b.mvpScope });
    setUseCases(b.useCases.length ? JSON.stringify(b.useCases) : "");
    setTarget(b.targetDate);
    setInvitees(r.draft.invitees);
    setIdea({ title: b.title, problem: b.problem });
    setVersion((v) => v + 1);
  };

  return (
    <div className="space-y-3">
      {allowDraft && <DraftFromSentence onDraft={applyDraft} />}
      <form
        key={version}
        ref={formRef}
        action={action}
        className="space-y-3"
        onBlur={(e) => {
          const name = (e.target as unknown as { name?: string }).name;
          if (name === "title" || name === "problem") setIdea({ title: field("title")?.value ?? "", problem: field("problem")?.value ?? "" });
        }}
      >
        {draft.id && <input type="hidden" name="id" value={draft.id} />}
        {draft.opportunityId && <input type="hidden" name="opportunityId" value={draft.opportunityId} />}
        {useCases && <input type="hidden" name="useCases" value={useCases} />}
        <input type="hidden" name="mvpScope" value={values.mvpScope ?? ""} />
        {invitees.map((u) => (
          <input key={u.id} type="hidden" name="invite" value={u.id} />
        ))}
        {draft.returnNote && (
          <div className="flex items-start gap-3 rounded-control border border-warning/30 bg-warning-soft px-4 py-3">
            <Flag size={16} strokeWidth={ICON_STROKE} className="mt-0.5 shrink-0 text-warning" aria-hidden />
            <p className="text-meta text-text">
              <span className="font-medium">Returned with a note: </span>
              {draft.returnNote}
            </p>
          </div>
        )}

        <Section label="The idea">
          <div className="space-y-4">
            <TextField id="title" name="title" label="Name" defaultValue={values.title} required maxLength={120} />
            <TextArea id="problem" name="problem" label="What problem does it solve, and how?" defaultValue={values.problem} rows={3} required />
            <AlreadyInFlight title={idea.title} problem={idea.problem} draftId={draft.id} />
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField id="whoBenefits" name="whoBenefits" label="Who benefits?" defaultValue={values.whoBenefits} required />
              <Select id="topicId" name="topicId" label="Topic" defaultValue={values.topicId} options={[{ value: "", label: "Choose a topic" }, ...topics.map((t) => ({ value: t.id, label: t.name }))]} />
            </div>
            <TextField id="successMetric" name="successMetric" label="How will you know it worked?" hint="One measurable sentence. You'll report against it once it's live." defaultValue={values.successMetric ?? ""} maxLength={240} />
            {invitees.length > 0 && (
              <Field label="Invite to the team">
                <div className="flex flex-wrap gap-2">
                  {useCases && <input type="hidden" name="useCases" value={useCases} />}
        <input type="hidden" name="mvpScope" value={values.mvpScope ?? ""} />
        {invitees.map((u) => (
                    <span key={u.id} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-subtle px-2.5 py-1 text-label text-text">
                      {u.name}
                      <button type="button" aria-label={`Don't invite ${u.name}`} onClick={() => setInvitees(invitees.filter((x) => x.id !== u.id))}>
                        <X size={12} strokeWidth={ICON_STROKE} />
                      </button>
                    </span>
                  ))}
                </div>
              </Field>
            )}
          </div>
        </Section>

        <Section label="What it takes">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-resources">
            <Select id="teamSize" name="teamSize" label="Team size" defaultValue={String(values.teamSize)} options={range(1, 10)} />
            <Select id="hoursPerWeek" name="hoursPerWeek" label="Hours a week each" defaultValue={String(values.hoursPerWeek)} options={range(1, 10)} />
            <Select id="lengthWeeks" name="lengthWeeks" label="Length" defaultValue={String(values.lengthWeeks)} options={range(1, 12, (n) => `${n} ${n === 1 ? "week" : "weeks"}`)} />
            <Select id="difficulty" name="difficulty" label="Difficulty" defaultValue={values.difficulty} options={[{ value: "EASY", label: "Easy" }, { value: "MODERATE", label: "Moderate" }, { value: "HARD", label: "Hard" }]} />
            <Field label="Target date" htmlFor="targetDate" className="col-span-2 lg:col-span-1">
              <div className={cx(controlClass, "relative flex w-full items-center justify-between")}>
                <span className={target ? "text-text" : "text-text-faint"}>{formatTarget(target)}</span>
                <Calendar size={15} strokeWidth={ICON_STROKE} className="text-text-muted" aria-hidden />
                <input id="targetDate" name="targetDate" type="date" value={target} onChange={(e) => setTarget(e.target.value)} onClick={(e) => e.currentTarget.showPicker?.()} required className="absolute inset-0 cursor-pointer opacity-0" />
              </div>
            </Field>
          </div>
          <div className="mt-5 flex flex-col-reverse items-stretch gap-3 sm:flex-row sm:items-center sm:justify-end">
            {state.error && <p className="text-label text-critical">{state.error}</p>}
            <Button type="submit" variant="primary" arrow disabled={pending}>
              Continue to review
            </Button>
          </div>
        </Section>
      </form>
    </div>
  );
}
