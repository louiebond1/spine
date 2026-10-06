"use client";

import { useState, useTransition } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { NumberField } from "@/components/ui/NumberField";
import { Select } from "@/components/ui/Select";
import { TextField } from "@/components/ui/TextField";
import { addTopic, removeTopic, renameTopic, saveImpact, saveRoles, saveRules } from "@/server/admin/actions";

type Result = { error?: string; saved?: boolean };

function Status({ result }: { result: Result | null }) {
  if (!result) return null;
  return <p className="text-label text-text-muted">{result.error ?? "Saved."}</p>;
}

function SettingRow({ title, hint, children }: { title: string; hint: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-6 py-5">
      <div>
        <p className="text-row-title font-semibold text-text">{title}</p>
        <p className="text-meta text-text-muted">{hint}</p>
      </div>
      <div className="flex items-center gap-4">{children}</div>
    </div>
  );
}

const TIMES = Array.from({ length: 24 }, (_, h) => `${String(h).padStart(2, "0")}:00`);

export function RulesTab({ initial }: { initial: { approvalTimeoutDays: number; approvalNudgeDays: number; approvalEscalateDays: number; stalledBuildDays: number; unclaimedQuestionHours: number; digestTime: string; digestWeekdaysOnly: boolean } }) {
  const [v, setV] = useState({ ...initial, digestChannel: "Slack" as const });
  const [result, setResult] = useState<Result | null>(null);
  const [pending, start] = useTransition();
  const num = (key: "approvalTimeoutDays" | "approvalNudgeDays" | "approvalEscalateDays" | "stalledBuildDays" | "unclaimedQuestionHours") => ({
    value: v[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => setV({ ...v, [key]: Number(e.target.value) }),
  });
  return (
    <>
      <section className="divide-y divide-border rounded-container border border-border bg-surface px-6">
        <SettingRow title="Approval timeout" hint="How long before an idea auto-approves">
          <NumberField aria-label="Approval timeout in days" min={1} suffix="days" {...num("approvalTimeoutDays")} />
        </SettingRow>
        <SettingRow title="Remind approvers" hint="Nudge whoever still has to approve after this long">
          <NumberField aria-label="Remind approvers after days" min={1} suffix="days" {...num("approvalNudgeDays")} />
        </SettingRow>
        <SettingRow title="Escalate stuck approvals" hint="When named approvers haven't decided, let any admin decide">
          <NumberField aria-label="Escalate after days" min={1} suffix="days" {...num("approvalEscalateDays")} />
        </SettingRow>
        <SettingRow title="Stalled build threshold" hint="When a quiet build gets flagged">
          <NumberField aria-label="Stalled build threshold in days" min={1} suffix="days" {...num("stalledBuildDays")} />
        </SettingRow>
        <SettingRow title="Unanswered question threshold" hint="When an unclaimed question gets flagged">
          <NumberField aria-label="Unanswered question threshold in hours" min={1} suffix="hours" {...num("unclaimedQuestionHours")} />
        </SettingRow>
        <SettingRow title="Daily Pulse digest" hint="Where and when the summary is sent">
          <div className="w-40">
            <Select aria-label="Digest channel" value="Slack" onChange={() => {}} options={[{ value: "Slack", label: "Slack" }]} />
          </div>
          <div className="w-44">
            <Select aria-label="Digest time" value={v.digestTime} onChange={(e) => setV({ ...v, digestTime: e.target.value })} options={TIMES.map((t) => ({ value: t, label: t }))} />
          </div>
          <span className="text-meta text-text-muted">{initial.digestWeekdaysOnly ? "each weekday" : "every day"}</span>
        </SettingRow>
      </section>
      <div className="mt-6 flex items-center gap-5">
        <Button variant="primary" disabled={pending} onClick={() => start(async () => setResult(await saveRules(v)))}>
          Save changes
        </Button>
        <Status result={result} />
      </div>
    </>
  );
}

type Person = { id: string; name: string; initials: string; isChampion: boolean; isAdmin: boolean; isPublishingSpecialist: boolean };

export function PeopleTab({ people }: { people: Person[] }) {
  const [rows, setRows] = useState(people);
  const [result, setResult] = useState<Result | null>(null);
  const [pending, start] = useTransition();
  const set = (id: string, key: "isChampion" | "isAdmin" | "isPublishingSpecialist", value: boolean) =>
    setRows(rows.map((r) => (r.id === id ? { ...r, [key]: value } : r)));
  return (
    <>
      <section className="divide-y divide-border rounded-container border border-border bg-surface px-6">
        {rows.map((p) => (
          <div key={p.id} className="flex items-center gap-6 py-4">
            <Avatar initials={p.initials} />
            <span className="flex-1 text-meta text-text">{p.name}</span>
            <Checkbox label="Champion" checked={p.isChampion} onChange={(e) => set(p.id, "isChampion", e.target.checked)} />
            <Checkbox label="Admin" checked={p.isAdmin} onChange={(e) => set(p.id, "isAdmin", e.target.checked)} />
            <Checkbox label="Publishing specialist" checked={p.isPublishingSpecialist} onChange={(e) => set(p.id, "isPublishingSpecialist", e.target.checked)} />
          </div>
        ))}
      </section>
      <div className="mt-6 flex items-center gap-5">
        <Button variant="primary" disabled={pending} onClick={() => start(async () => setResult(await saveRoles(rows.map(({ name: _n, initials: _i, ...r }) => r))))}>
          Save changes
        </Button>
        <Status result={result} />
      </div>
    </>
  );
}

function TopicRow({ topic }: { topic: { id: string; name: string } }) {
  const [name, setName] = useState(topic.name);
  const [result, setResult] = useState<Result | null>(null);
  const [pending, start] = useTransition();
  const changed = name.trim() !== topic.name;
  return (
    <div className="flex items-center gap-5 py-3">
      <div className="w-80">
        <TextField aria-label={`Rename ${topic.name}`} value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <span className="flex-1" />
      {changed && (
        <Button disabled={pending} onClick={() => start(async () => setResult(await renameTopic(topic.id, name)))}>
          Rename
        </Button>
      )}
      <Button variant="text" disabled={pending} onClick={() => start(async () => setResult(await removeTopic(topic.id)))}>
        Remove
      </Button>
      <Status result={result?.error ? result : null} />
    </div>
  );
}

export function TopicsTab({ topics }: { topics: { id: string; name: string }[] }) {
  const [name, setName] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [pending, start] = useTransition();
  return (
    <section className="rounded-container border border-border bg-surface px-6">
      <div className="divide-y divide-border">
        {topics.map((t) => (
          <TopicRow key={t.id + t.name} topic={t} />
        ))}
      </div>
      <div className="flex items-center gap-5 border-t border-border py-4">
        <div className="w-80">
          <TextField aria-label="New topic" placeholder="New topic" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <Button
          disabled={pending || !name.trim()}
          onClick={() =>
            start(async () => {
              const r = await addTopic(name);
              setResult(r);
              if (!r.error) setName("");
            })
          }
        >
          Add
        </Button>
        <Status result={result?.error ? result : null} />
      </div>
    </section>
  );
}

export function ImpactTab({ initial }: { initial: { hourlyCost: string; programmeCost: string } }) {
  const [v, setV] = useState(initial);
  const [result, setResult] = useState<Result | null>(null);
  const [pending, start] = useTransition();
  return (
    <>
      <section className="divide-y divide-border rounded-container border border-border bg-surface px-6">
        <SettingRow title="Hourly cost" hint="Used to estimate the value of hours saved">
          <span className="text-meta text-text-muted">£</span>
          <NumberField aria-label="Hourly cost in pounds" min={0} className="w-32" value={v.hourlyCost} onChange={(e) => setV({ ...v, hourlyCost: e.target.value })} suffix="per hour" />
        </SettingRow>
        <SettingRow title="Programme cost" hint="What the AI programme costs to run">
          <span className="text-meta text-text-muted">£</span>
          <NumberField aria-label="Programme cost in pounds" min={0} className="w-32" value={v.programmeCost} onChange={(e) => setV({ ...v, programmeCost: e.target.value })} />
        </SettingRow>
      </section>
      <div className="mt-6 flex items-center gap-5">
        <Button variant="primary" disabled={pending} onClick={() => start(async () => setResult(await saveImpact(v)))}>
          Save changes
        </Button>
        <Status result={result} />
      </div>
    </>
  );
}
