"use client";

import { useActionState, useRef, useState, useTransition } from "react";
import { Box, Calendar, Flag, Laptop, Sparkles, type LucideIcon } from "lucide-react";
import { cx } from "@/lib/cx";
import { Button } from "@/components/ui/Button";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { TextField } from "@/components/ui/TextField";
import { TextArea } from "@/components/ui/TextArea";
import { Select } from "@/components/ui/Select";
import { Field, controlClass } from "@/components/ui/Field";
import { ICON_STROKE } from "@/components/ui/icons";
import { saveDraft, type ProposeState } from "@/server/projects/actions";
import { sharpenIdea, type Sharpened } from "@/server/ai/sharpen";

export type IdeaDraft = {
  id?: string;
  title: string;
  problem: string;
  whoBenefits: string;
  topicId: string;
  buildPath: "APP" | "COWORK_NATIVE";
  teamSize: number;
  hoursPerWeek: number;
  lengthWeeks: number;
  difficulty: "EASY" | "MODERATE" | "HARD";
  /** yyyy-mm-dd */
  targetDate: string;
  returnNote?: string | null;
  /** Set when proposing a "Spotted by Spine" opportunity. */
  opportunityId?: string;
};

const range = (from: number, to: number, label: (n: number) => string = String) =>
  Array.from({ length: to - from + 1 }, (_, i) => ({ value: String(from + i), label: label(from + i) }));

const PATHS: { value: IdeaDraft["buildPath"]; icon: LucideIcon; title: string; lines: string[] }[] = [
  { value: "APP", icon: Box, title: "App", lines: ["Needs infrastructure, hosting or admin access.", "Leadership approves before recruiting."] },
  {
    value: "COWORK_NATIVE",
    icon: Laptop,
    title: "Cowork-native",
    lines: ["Built within approved workplace tools.", "Leadership approves after the build."],
  },
];

function formatTarget(value: string) {
  if (!value) return "Choose a date";
  const [y, m, d] = value.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, d!)).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section className="rounded-container border border-border bg-surface px-6 pb-5 pt-5">
      <SectionLabel className="mb-3">{label}</SectionLabel>
      {children}
    </section>
  );
}

export function ProposeForm({ draft, topics }: { draft: IdeaDraft; topics: { id: string; name: string }[] }) {
  const [state, action, pending] = useActionState<ProposeState, FormData>(saveDraft, {});
  const [path, setPath] = useState(draft.buildPath);
  const [target, setTarget] = useState(draft.targetDate);
  const formRef = useRef<HTMLFormElement>(null);
  const [suggestion, setSuggestion] = useState<Sharpened | null>(null);
  const [sharpenError, setSharpenError] = useState<string | null>(null);
  const [sharpening, startSharpen] = useTransition();

  const field = (name: string) => formRef.current?.elements.namedItem(name) as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null;
  const sharpen = () =>
    startSharpen(async () => {
      setSharpenError(null);
      const r = await sharpenIdea({
        title: field("title")?.value ?? "",
        problem: field("problem")?.value ?? "",
        whoBenefits: field("whoBenefits")?.value ?? "",
        buildPath: path,
      });
      if (r.ok) setSuggestion(r.result);
      else setSharpenError(r.error);
    });
  const useSuggestion = () => {
    if (!suggestion) return;
    const set = (name: string, value: string) => {
      const el = field(name);
      if (el) el.value = value;
    };
    set("title", suggestion.title);
    set("problem", suggestion.problem);
    set("whoBenefits", suggestion.whoBenefits);
    if (suggestion.topicId) set("topicId", suggestion.topicId);
    set("teamSize", String(suggestion.teamSize));
    set("lengthWeeks", String(suggestion.lengthWeeks));
    set("difficulty", suggestion.difficulty);
    setSuggestion(null);
  };

  return (
    <form ref={formRef} action={action} className="space-y-3">
      {draft.id && <input type="hidden" name="id" value={draft.id} />}
      {draft.opportunityId && <input type="hidden" name="opportunityId" value={draft.opportunityId} />}
      {draft.returnNote && (
        <div className="flex items-start gap-4 rounded-control bg-neutral-soft px-5 py-4">
          <Flag size={18} strokeWidth={ICON_STROKE} className="mt-0.5 shrink-0 text-text" aria-hidden />
          <p className="text-meta text-text">{draft.returnNote}</p>
        </div>
      )}

      <Section label="The idea">
        <div className="space-y-4">
          <TextField id="title" name="title" label="Name your idea" defaultValue={draft.title} required maxLength={120} />
          <TextArea id="problem" name="problem" label="What problem does it solve?" defaultValue={draft.problem} rows={3} required />
          <div className="grid grid-cols-2 gap-5">
            <TextField id="whoBenefits" name="whoBenefits" label="Who benefits?" defaultValue={draft.whoBenefits} required />
            <Select
              id="topicId"
              name="topicId"
              label="Topic"
              defaultValue={draft.topicId}
              options={[{ value: "", label: "Choose a topic" }, ...topics.map((t) => ({ value: t.id, label: t.name }))]}
            />
          </div>
          <div className="flex items-center gap-4">
            <button type="button" onClick={sharpen} disabled={sharpening} className="inline-flex items-center gap-2 text-meta font-medium text-brand hover:text-brand-hover disabled:opacity-50">
              <Sparkles size={16} strokeWidth={ICON_STROKE} aria-hidden />
              {sharpening ? "Sharpening…" : "Sharpen with Spine"}
            </button>
            {sharpenError && <span className="text-label text-text-muted">{sharpenError}</span>}
          </div>
          {suggestion && (
            <div className="rounded-control border border-brand-soft bg-surface p-5">
              <p className="text-label font-semibold text-brand">Spine&apos;s version</p>
              <p className="mt-2 text-row-title font-semibold text-text">{suggestion.title}</p>
              <p className="mt-1 text-meta text-text">{suggestion.problem}</p>
              <p className="mt-2 text-label text-text-muted">
                For {suggestion.whoBenefits} · {suggestion.teamSize} {suggestion.teamSize === 1 ? "person" : "people"} · {suggestion.lengthWeeks} weeks ·{" "}
                {suggestion.difficulty.charAt(0) + suggestion.difficulty.slice(1).toLowerCase()}
              </p>
              <p className="mt-3 text-label text-text-muted">Tip: {suggestion.tip}</p>
              <div className="mt-4 flex items-center gap-4">
                <Button onClick={useSuggestion}>Use this</Button>
                <Button variant="text" onClick={() => setSuggestion(null)}>
                  Keep mine
                </Button>
              </div>
            </div>
          )}
        </div>
      </Section>

      <Section label="How it gets built">
        <div className="grid grid-cols-2 gap-5" role="radiogroup" aria-label="How it gets built">
          {PATHS.map((p) => {
            const selected = path === p.value;
            const Icon = p.icon;
            return (
              <label
                key={p.value}
                className={cx(
                  "flex cursor-pointer items-start gap-5 rounded-control border px-5 py-5",
                  selected ? "border-brand bg-brand-soft" : "border-border bg-surface hover:border-text-muted",
                )}
              >
                <input type="radio" name="buildPath" value={p.value} checked={selected} onChange={() => setPath(p.value)} className="sr-only" />
                <span
                  className={cx("mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2", selected ? "border-brand" : "border-border")}
                  aria-hidden
                >
                  {selected && <span className="h-3 w-3 rounded-full bg-brand" />}
                </span>
                <Icon size={24} strokeWidth={ICON_STROKE} className="shrink-0 text-text" aria-hidden />
                <span>
                  <span className="block text-row-title font-semibold text-text">{p.title}</span>
                  {p.lines.map((line) => (
                    <span key={line} className="block text-label text-text-muted">
                      {line}
                    </span>
                  ))}
                </span>
              </label>
            );
          })}
        </div>
      </Section>

      <Section label="Resources">
        <div className="grid grid-cols-resources gap-5">
          <Select id="teamSize" name="teamSize" label="Team size" defaultValue={String(draft.teamSize)} options={range(1, 10)} />
          <Select id="hoursPerWeek" name="hoursPerWeek" label="Hours per week" defaultValue={String(draft.hoursPerWeek)} options={range(1, 10)} />
          <Select
            id="lengthWeeks"
            name="lengthWeeks"
            label="Length"
            defaultValue={String(draft.lengthWeeks)}
            options={range(1, 12, (n) => `${n} ${n === 1 ? "week" : "weeks"}`)}
          />
          <Select
            id="difficulty"
            name="difficulty"
            label="Difficulty"
            defaultValue={draft.difficulty}
            options={[
              { value: "EASY", label: "Easy" },
              { value: "MODERATE", label: "Moderate" },
              { value: "HARD", label: "Hard" },
            ]}
          />
          <Field label="Target date" htmlFor="targetDate">
            {/* The native date picker sits invisibly over a field that shows "26 November 2026". */}
            <div className={cx(controlClass, "relative flex w-full items-center justify-between")}>
              <span className={target ? "text-text" : "text-text-muted"}>{formatTarget(target)}</span>
              <Calendar size={18} strokeWidth={ICON_STROKE} className="text-text" aria-hidden />
              <input
                id="targetDate"
                name="targetDate"
                type="date"
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                onClick={(e) => e.currentTarget.showPicker?.()}
                required
                className="absolute inset-0 cursor-pointer opacity-0"
              />
            </div>
          </Field>
        </div>
        <div className="mt-5 flex items-center justify-end gap-5">
          {state.error && <p className="text-label text-text-muted">{state.error}</p>}
          <Button type="submit" variant="primary" arrow disabled={pending}>
            Continue to AI review
          </Button>
        </div>
      </Section>
    </form>
  );
}
