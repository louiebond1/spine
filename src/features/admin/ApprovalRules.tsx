"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { ArrowDown, ArrowUp, Sparkles } from "lucide-react";
import { cx } from "@/lib/cx";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { NumberField } from "@/components/ui/NumberField";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { TextField } from "@/components/ui/TextField";
import { ICON_STROKE } from "@/components/ui/icons";
import { deleteRule, draftRuleFromText, moveRule, previewRule, saveRule, toggleRule, type RuleInput } from "@/server/approvals/actions";

export type RuleRow = { id: string; name: string; active: boolean; sentence: string; input: RuleInput };
type Option = { id: string; name: string };

const EMPTY: RuleInput = {
  name: "",
  topicIds: [],
  buildPaths: [],
  difficulties: [],
  minTotalHours: null,
  maxTotalHours: null,
  onlyWithConcerns: false,
  approverIds: [],
  requireAll: false,
  autoApproveDays: 7,
  fastTrack: false,
};

const EXAMPLES = [
  "Legal and Finance apps need both Alex and Louie to approve, and never auto-approve",
  "Fast track easy Cowork-native ideas under 40 hours",
  "Anything over 200 hours goes to Alex and auto-approves after 10 days",
];

const toggle = <T,>(xs: T[], x: T) => (xs.includes(x) ? xs.filter((y) => y !== x) : [...xs, x]);

function Chips<T extends string>({ options, value, onChange }: { options: { id: T; name: string }[]; value: T[]; onChange: (v: T[]) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          aria-pressed={value.includes(o.id)}
          onClick={() => onChange(toggle(value, o.id))}
          className={cx(
            "rounded-full border px-3 py-1 text-label",
            value.includes(o.id) ? "border-brand bg-brand-soft text-brand" : "border-border text-text-muted hover:border-brand hover:text-brand",
          )}
        >
          {o.name}
        </button>
      ))}
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-4 gap-6 py-4">
      <div>
        <p className="text-meta font-medium text-text">{label}</p>
        {hint && <p className="text-label text-text-muted">{hint}</p>}
      </div>
      <div className="col-span-3">{children}</div>
    </div>
  );
}

function Editor({ id, initial, topics, people, onDone }: { id: string | null; initial: RuleInput; topics: Option[]; people: Option[]; onDone: () => void }) {
  const [r, setR] = useState<RuleInput>(initial);
  const [sentence, setSentence] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const set = <K extends keyof RuleInput>(k: K, v: RuleInput[K]) => setR((x) => ({ ...x, [k]: v }));
  const num = (v: string) => (v === "" ? null : Math.max(0, Math.round(Number(v)) || 0));

  useEffect(() => {
    let live = true;
    const t = setTimeout(() => previewRule(r).then((s) => live && setSentence(s)), 250);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [r]);

  return (
    <section className="mt-5 rounded-container border border-brand bg-surface px-6 py-5">
      <SectionLabel>{id ? "Edit rule" : "New rule"}</SectionLabel>
      <div className="divide-y divide-border">
        <Field label="Name">
          <TextField aria-label="Rule name" value={r.name} onChange={(e) => set("name", e.target.value)} placeholder="Leadership sign-off for Legal" />
        </Field>
        <Field label="Topics" hint="None picked means any topic">
          <Chips options={topics} value={r.topicIds} onChange={(v) => set("topicIds", v)} />
        </Field>
        <Field label="Build path" hint="None picked means either">
          <Chips
            options={[
              { id: "APP", name: "App" },
              { id: "COWORK_NATIVE", name: "Cowork-native" },
            ]}
            value={r.buildPaths}
            onChange={(v) => set("buildPaths", v)}
          />
        </Field>
        <Field label="Difficulty" hint="None picked means any">
          <Chips
            options={[
              { id: "EASY", name: "Easy" },
              { id: "MODERATE", name: "Moderate" },
              { id: "HARD", name: "Hard" },
            ]}
            value={r.difficulties}
            onChange={(v) => set("difficulties", v)}
          />
        </Field>
        <Field label="Total effort" hint="People x hours a week x weeks">
          <div className="flex items-center gap-4">
            <NumberField aria-label="At least hours" min={0} suffix="hrs min" value={r.minTotalHours ?? ""} onChange={(e) => set("minTotalHours", num(e.target.value))} />
            <NumberField aria-label="At most hours" min={0} suffix="hrs max" value={r.maxTotalHours ?? ""} onChange={(e) => set("maxTotalHours", num(e.target.value))} />
          </div>
          <div className="mt-3">
            <Checkbox checked={r.onlyWithConcerns} onChange={(e) => set("onlyWithConcerns", e.target.checked)} label="Only when the AI review raised concerns" />
          </div>
        </Field>
        <Field label="Outcome">
          <Checkbox checked={r.fastTrack} onChange={(e) => set("fastTrack", e.target.checked)} label="Fast track: approve straight away, no review" />
        </Field>
        {!r.fastTrack && (
          <>
            <Field label="Approvers" hint="Anyone, not just admins. None picked means any admin">
              <Chips options={people} value={r.approverIds} onChange={(v) => set("approverIds", v)} />
              {r.approverIds.length > 1 && (
                <div className="mt-3">
                  <Checkbox checked={r.requireAll} onChange={(e) => set("requireAll", e.target.checked)} label="Everyone picked must approve" />
                </div>
              )}
            </Field>
            <Field label="Auto-approve">
              <div className="flex items-center gap-6">
                <Checkbox checked={r.autoApproveDays != null} onChange={(e) => set("autoApproveDays", e.target.checked ? 7 : null)} label="Auto-approve if nobody acts" />
                {r.autoApproveDays != null && (
                  <NumberField aria-label="Auto-approve after days" min={1} max={90} suffix="days" value={r.autoApproveDays} onChange={(e) => set("autoApproveDays", Math.max(1, num(e.target.value) ?? 1))} />
                )}
              </div>
            </Field>
          </>
        )}
      </div>
      <div className="mt-2 flex items-center justify-between gap-6 border-t border-border pt-5">
        <p className="text-meta text-text">{sentence}</p>
        <div className="flex shrink-0 items-center gap-4">
          {error && <p className="text-label text-text-muted">{error}</p>}
          <Button variant="text" onClick={onDone} disabled={pending}>
            Cancel
          </Button>
          <Button
            variant="primary"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const res = await saveRule(id, r);
                if (!res.ok) return setError(res.error);
                onDone();
              })
            }
          >
            Save rule
          </Button>
        </div>
      </div>
    </section>
  );
}

/** Admin > Approvals: who approves what, checked top to bottom, first match wins. */
export function ApprovalRules({ rules, topics, people, defaultDays }: { rules: RuleRow[]; topics: Option[]; people: Option[]; defaultDays: number }) {
  const [editing, setEditing] = useState<{ id: string | null; input: RuleInput; key: number } | null>(null);
  const seq = useRef(0);
  const [text, setText] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const write = () =>
    start(async () => {
      setNote(null);
      const r = await draftRuleFromText(text);
      if (!r.ok) return setNote(r.error);
      setEditing({ id: null, input: r.rule, key: ++seq.current });
      if (r.unknown.length) setNote(`Spine couldn't match ${r.unknown.join(", ")}. Check the rule below.`);
    });

  return (
    <div>
      <section className="rounded-container border border-border bg-surface px-6 py-5">
        <p className="flex items-center gap-2 text-label font-semibold text-brand">
          <Sparkles size={14} strokeWidth={ICON_STROKE} aria-hidden />
          Describe a rule and Spine writes it
        </p>
        <div className="mt-3 flex items-center gap-4">
          <div className="flex-1">
            <TextField
              aria-label="Describe an approval rule"
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && text.trim() && write()}
              placeholder="Legal apps need both Alex and Louie to approve, and never auto-approve"
            />
          </div>
          <Button onClick={write} disabled={pending || text.trim().length < 8}>
            {pending ? "Writing…" : "Write the rule"}
          </Button>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {EXAMPLES.map((e) => (
            <button key={e} type="button" onClick={() => setText(e)} className="rounded-full border border-border px-3 py-1 text-label text-text-muted hover:border-brand hover:text-brand">
              {e}
            </button>
          ))}
        </div>
        {note && <p className="mt-3 text-label text-text-muted">{note}</p>}
      </section>

      {editing && (
        <Editor
          key={editing.key}
          id={editing.id}
          initial={editing.input}
          topics={topics}
          people={people}
          onDone={() => {
            setEditing(null);
            setText("");
          }}
        />
      )}

      <section className="mt-5 rounded-container border border-border bg-surface px-6">
        <div className="flex items-center justify-between py-4">
          <p className="text-label text-text-muted">Checked top to bottom. The first rule that matches decides.</p>
          {!editing && (
            <button type="button" onClick={() => setEditing({ id: null, input: EMPTY, key: ++seq.current })} className="text-meta font-medium text-brand hover:text-brand-hover">
              + Add rule
            </button>
          )}
        </div>
        <div className="divide-y divide-border border-t border-border">
          {rules.map((r, i) => (
            <div key={r.id} className={cx("flex items-center gap-6 py-5", !r.active && "opacity-60")}>
              <div className="flex flex-col">
                <button type="button" aria-label={`Move ${r.name} up`} disabled={i === 0 || pending} onClick={() => start(() => moveRule(r.id, "up"))} className="text-text-muted hover:text-brand disabled:opacity-30">
                  <ArrowUp size={16} strokeWidth={ICON_STROKE} />
                </button>
                <button
                  type="button"
                  aria-label={`Move ${r.name} down`}
                  disabled={i === rules.length - 1 || pending}
                  onClick={() => start(() => moveRule(r.id, "down"))}
                  className="text-text-muted hover:text-brand disabled:opacity-30"
                >
                  <ArrowDown size={16} strokeWidth={ICON_STROKE} />
                </button>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-row-title font-medium text-text">{r.name}</p>
                <p className="text-meta text-text-muted">{r.sentence}</p>
              </div>
              <ActiveToggle id={r.id} active={r.active} />
              <Button variant="text" onClick={() => setEditing({ id: r.id, input: r.input, key: ++seq.current })}>
                Edit
              </Button>
              <Button variant="text" disabled={pending} onClick={() => start(() => deleteRule(r.id))}>
                Remove
              </Button>
            </div>
          ))}
          <div className="py-5">
            <p className="text-row-title font-medium text-text">Everything else</p>
            <p className="text-meta text-text-muted">
              Any admin approves and it auto-approves after {defaultDays} {defaultDays === 1 ? "day" : "days"}. Change the timeout in Rules.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

function ActiveToggle({ id, active }: { id: string; active: boolean }) {
  const [on, setOn] = useState(active);
  const [, start] = useTransition();
  return (
    <Checkbox
      checked={on}
      onChange={(e) => {
        const next = e.target.checked;
        setOn(next);
        start(() => toggleRule(id, next));
      }}
      label="On"
    />
  );
}
