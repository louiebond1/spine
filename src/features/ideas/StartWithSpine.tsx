"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowUp, Sparkles } from "lucide-react";
import { cx } from "@/lib/cx";
import { Button } from "@/components/ui/Button";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { ICON_STROKE } from "@/components/ui/icons";
import { AlreadyInFlight } from "./AlreadyInFlight";
import type { IdeaBrief } from "@/server/ai/coach";
import { createFromBrief, nextCoachTurn, previewKickoff } from "@/server/ideas/start-actions";

type Line = { role: "spine" | "user"; text: string; suggestions?: string[] };

const EXAMPLES = [
  "A supplier risk checker with Mia and Ben by December",
  "Turn our weekly client status emails into a 5 minute job",
  "Something that answers new starters' HR questions",
];

const DIFFICULTY = { EASY: "Easy", MODERATE: "Moderate", HARD: "Hard" } as const;

function formatDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, d!)).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}

function BriefPreview({ brief, onReset }: { brief: IdeaBrief; onReset: () => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <section className="rounded-container border border-border bg-surface px-6 py-6">
        <p className="flex items-center gap-2 text-label font-semibold text-brand">
          <Sparkles size={14} strokeWidth={ICON_STROKE} aria-hidden />
          Here&apos;s your idea, ready to go
        </p>
        <h2 className="mt-3 text-section font-semibold text-text">{brief.title}</h2>
        <p className="mt-2 text-meta text-text">{brief.problem}</p>
        <p className="mt-3 text-label text-text-muted">
          For {brief.whoBenefits} · {brief.topic} · {brief.buildPath === "APP" ? "App" : "Cowork-native"} · {brief.teamSize} {brief.teamSize === 1 ? "person" : "people"} ·{" "}
          {brief.hoursPerWeek} hrs a week · {brief.lengthWeeks} weeks · {DIFFICULTY[brief.difficulty]} · Target {formatDate(brief.targetDate)}
        </p>
        {brief.people.length > 0 && <p className="mt-2 text-label text-text-muted">Spine will invite {brief.people.join(" and ")}.</p>}
      </section>

      <AlreadyInFlight title={brief.title} problem={brief.problem} />

      {brief.useCases.length > 0 && (
        <section className="rounded-container border border-border bg-surface px-6 py-5">
          <SectionLabel>Real use cases</SectionLabel>
          <div className="mt-3 divide-y divide-border">
            {brief.useCases.map((u, i) => (
              <div key={i} className="py-3">
                <p className="text-meta font-medium text-text">{u.who}</p>
                <p className="mt-1 text-meta text-text-muted">{u.scenario}</p>
                <p className="mt-1 text-label text-text">Result: {u.outcome}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {(brief.successMetric || brief.mvpScope) && (
        <section className="grid grid-cols-3 gap-6 rounded-container border border-border bg-surface px-6 py-5">
          <div>
            <SectionLabel>Success looks like</SectionLabel>
            <p className="mt-2 text-meta text-text">{brief.successMetric}</p>
            {brief.hoursSavedEstimate > 0 && <p className="mt-2 text-label text-text-muted">About {brief.hoursSavedEstimate} hours saved a month</p>}
          </div>
          <div>
            <SectionLabel>First version</SectionLabel>
            <p className="mt-2 text-meta text-text">{brief.mvpScope}</p>
          </div>
          <div>
            <SectionLabel>Can wait</SectionLabel>
            <p className="mt-2 text-meta text-text-muted">{brief.laterScope}</p>
          </div>
        </section>
      )}

      <div className="flex items-center justify-end gap-5">
        {error && <p className="text-label text-text-muted">{error}</p>}
        <Button variant="text" onClick={onReset} disabled={pending}>
          Start over
        </Button>
        <Button
          variant="primary"
          arrow
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await createFromBrief(brief);
              if (!r.ok) return setError(r.error);
              router.push(`/ideas/${r.id}/review`);
            })
          }
        >
          {pending ? "Creating…" : "Create idea"}
        </Button>
      </div>
      <p className="text-right text-tiny text-text-muted">Spine runs the AI review and drafts the plan next. You can still edit everything before submitting.</p>
    </div>
  );
}

export function StartWithSpine({ firstName }: { firstName: string }) {
  const [sentence, setSentence] = useState("");
  const [mode, setMode] = useState<"start" | "coach" | "brief">("start");
  const [lines, setLines] = useState<Line[]>([]);
  const [answer, setAnswer] = useState("");
  const [brief, setBrief] = useState<IdeaBrief | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [lines]);

  const reset = () => {
    setMode("start");
    setLines([]);
    setBrief(null);
    setError(null);
  };

  const buildNow = () =>
    start(async () => {
      setError(null);
      const r = await previewKickoff(sentence);
      if (!r.ok) return setError(r.error);
      setBrief(r.brief);
      setMode("brief");
    });

  const coach = (transcript: Line[]) =>
    start(async () => {
      setError(null);
      const r = await nextCoachTurn(transcript.map(({ role, text }) => ({ role, text })));
      if (!r.ok) return setError(r.error);
      if (r.turn.done && r.turn.brief) {
        setBrief(r.turn.brief);
        setMode("brief");
      } else {
        setLines([...transcript, { role: "spine", text: r.turn.question, suggestions: r.turn.suggestions }]);
      }
    });

  const talkItThrough = () => {
    if (sentence.trim().length < 6) return setError("Start with a sentence about your idea.");
    const first: Line[] = [{ role: "user", text: sentence.trim() }];
    setLines(first);
    setMode("coach");
    coach(first);
  };

  const reply = (text: string) => {
    const t = text.trim();
    if (!t || pending) return;
    setAnswer("");
    const next = [...lines.map((l) => ({ ...l, suggestions: undefined })), { role: "user" as const, text: t }];
    setLines(next);
    coach(next);
  };

  if (mode === "brief" && brief) return <BriefPreview brief={brief} onReset={reset} />;

  if (mode === "coach") {
    const last = lines[lines.length - 1];
    return (
      <section className="rounded-container border border-border bg-surface">
        <div className="max-h-coach space-y-5 overflow-y-auto px-6 py-6">
          {lines.map((l, i) =>
            l.role === "user" ? (
              <div key={i} className="flex justify-end">
                <p className="max-w-xl rounded-container bg-brand-soft px-4 py-3 text-meta text-text">{l.text}</p>
              </div>
            ) : (
              <div key={i} className="flex gap-3">
                <span className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand" aria-hidden>
                  <Sparkles size={14} strokeWidth={ICON_STROKE} />
                </span>
                <div>
                  <p className="text-meta text-text">{l.text}</p>
                  {l.suggestions && l.suggestions.length > 0 && i === lines.length - 1 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {l.suggestions.map((s) => (
                        <button key={s} type="button" disabled={pending} onClick={() => reply(s)} className="rounded-full border border-border px-3 py-1 text-label text-text hover:border-brand hover:text-brand">
                          {s}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ),
          )}
          {pending && <p className="animate-pulse pl-10 text-label text-text-muted">{last?.role === "user" && lines.length > 6 ? "Writing your brief…" : "Thinking…"}</p>}
          <div ref={endRef} />
        </div>
        <form
          className="flex items-end gap-2 border-t border-border p-4"
          onSubmit={(e) => {
            e.preventDefault();
            reply(answer);
          }}
        >
          <textarea
            rows={1}
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                reply(answer);
              }
            }}
            placeholder="Type your answer…"
            aria-label="Your answer"
            className="max-h-32 flex-1 resize-none rounded-control border border-border px-4 py-2 text-meta text-text placeholder:text-text-muted focus:border-brand focus:outline-none"
          />
          <button type="submit" disabled={pending || !answer.trim()} aria-label="Send" className="flex h-10 w-10 items-center justify-center rounded-control bg-brand text-on-brand disabled:opacity-40">
            <ArrowUp size={16} strokeWidth={2} />
          </button>
        </form>
        {error && <p className="px-6 pb-4 text-label text-text-muted">{error}</p>}
        <div className="flex justify-end border-t border-border px-6 py-3">
          <button type="button" onClick={() => reply("That's everything I know for now, please write the brief.")} disabled={pending} className="text-label text-brand hover:text-brand-hover">
            Skip ahead and write the brief
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-container border border-border bg-surface px-6 py-6">
      <p className="text-row-title font-semibold text-text">What do you want to build, {firstName}?</p>
      <p className="mt-1 text-meta text-text-muted">One sentence is enough. Mention people and a date if you have them.</p>
      <textarea
        rows={3}
        value={sentence}
        onChange={(e) => setSentence(e.target.value)}
        placeholder="Let's build a supplier risk checker with Mia and Ben by December"
        aria-label="Your idea in a sentence"
        className="mt-4 w-full rounded-control border border-border px-4 py-3 text-meta text-text placeholder:text-text-muted focus:border-brand focus:outline-none"
      />
      <div className="mt-3 flex flex-wrap gap-2">
        {EXAMPLES.map((e) => (
          <button key={e} type="button" onClick={() => setSentence(e)} className="rounded-full border border-border px-3 py-1 text-label text-text-muted hover:border-brand hover:text-brand">
            {e}
          </button>
        ))}
      </div>
      <div className="mt-5 flex items-center justify-end gap-4">
        {error && <p className={cx("text-label text-text-muted")}>{error}</p>}
        <Button onClick={talkItThrough} disabled={pending}>
          Talk it through with Spine
        </Button>
        <Button variant="primary" arrow onClick={buildNow} disabled={pending || sentence.trim().length < 6}>
          {pending ? "Building…" : "Build it now"}
        </Button>
      </div>
    </section>
  );
}
