"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { NumberField } from "@/components/ui/NumberField";
import { Select } from "@/components/ui/Select";
import { TextField } from "@/components/ui/TextField";
import { Container } from "@/components/ui/Container";
import { Notice } from "@/components/ui/States";
import { addTopic, removeTopic, removeWebhook, renameTopic, saveImpact, saveOrganisation, saveRules, saveWebhook, testChannels } from "@/server/admin/actions";
import { invitePerson, resetAccess, revokeInvitation, setActive, setEmail, setRoles } from "@/server/people/actions";

type Result = { error?: string; saved?: boolean; message?: string };

function Status({ result }: { result: Result | null }) {
  if (!result) return null;
  return <p className={result.error ? "text-label text-critical" : "text-label text-text-muted"}>{result.error ?? result.message ?? "Saved."}</p>;
}

function SettingRow({ title, hint, children }: { title: string; hint: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-meta font-medium text-text">{title}</p>
        <p className="text-label text-text-muted">{hint}</p>
      </div>
      <div className="flex flex-wrap items-center gap-3">{children}</div>
    </div>
  );
}

function SaveBar({ onSave, pending, result }: { onSave: () => void; pending: boolean; result: Result | null }) {
  return (
    <div className="mt-3 flex items-center gap-3">
      <Button variant="primary" disabled={pending} onClick={onSave}>
        Save changes
      </Button>
      <Status result={result} />
    </div>
  );
}

/** A single-use link the admin can copy, with whether it was also emailed. */
function LinkResult({ link, emailed }: { link: string; emailed?: boolean }) {
  const [copied, setCopied] = useState(false);
  return (
    <Notice tone="positive" className="mt-3">
      <p>{emailed ? "Emailed. You can also share this link directly:" : "Email isn't set up, so share this link with them directly (Teams or Slack message is fine):"}</p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <code className="min-w-0 flex-1 break-all rounded-sm bg-surface px-2 py-1 text-tiny text-text">{link}</code>
        <Button
          size="sm"
          onClick={() => {
            void navigator.clipboard?.writeText(link);
            setCopied(true);
          }}
        >
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
      <p className="mt-1 text-tiny text-text-muted">It works once and expires in 7 days.</p>
    </Notice>
  );
}

// ---------------------------------------------------------------------------
// People
// ---------------------------------------------------------------------------

export type PersonRow = {
  id: string;
  name: string;
  initials: string;
  email: string | null;
  status: "ACTIVE" | "INVITED" | "DEACTIVATED";
  hasPassword: boolean;
  lastLogin: string | null;
  isChampion: boolean;
  isAdmin: boolean;
  isPublishingSpecialist: boolean;
  launching: number;
  isYou: boolean;
};
export type InvitationRow = { id: string; name: string; email: string; expires: string };

function InviteForm() {
  const router = useRouter();
  const [v, setV] = useState({ name: "", email: "", isChampion: false, isAdmin: false, isPublishingSpecialist: false });
  const [error, setError] = useState<string | null>(null);
  const [link, setLink] = useState<{ link: string; emailed?: boolean } | null>(null);
  const [pending, start] = useTransition();
  return (
    <Container heading="Invite people" variant="plain">
      <div className="grid gap-3 sm:grid-cols-2">
        <TextField id="invite-name" label="Name" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} />
        <TextField id="invite-email" label="Work email" type="email" value={v.email} onChange={(e) => setV({ ...v, email: e.target.value })} />
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2">
        <Checkbox label="Champion" checked={v.isChampion} onChange={(e) => setV({ ...v, isChampion: e.target.checked })} />
        <Checkbox label="Admin" checked={v.isAdmin} onChange={(e) => setV({ ...v, isAdmin: e.target.checked })} />
        <Checkbox label="Publishing specialist" checked={v.isPublishingSpecialist} onChange={(e) => setV({ ...v, isPublishingSpecialist: e.target.checked })} />
        <span className="flex-1" />
        <Button
          variant="primary"
          disabled={pending || !v.name || !v.email}
          onClick={() =>
            start(async () => {
              setError(null);
              setLink(null);
              const r = await invitePerson(v);
              if (!r.ok) return setError(r.error);
              setLink({ link: r.link!, emailed: r.emailed });
              setV({ name: "", email: "", isChampion: false, isAdmin: false, isPublishingSpecialist: false });
              router.refresh();
            })
          }
        >
          Send invitation
        </Button>
      </div>
      <p className="mt-2 text-tiny text-text-muted">Everyone can ask questions, propose ideas and join initiatives. Champions answer the Help Desk. Admins manage Spine and approve ideas. Publishing specialists launch finished initiatives.</p>
      {error && <p className="mt-2 text-label text-critical">{error}</p>}
      {link && <LinkResult link={link.link} emailed={link.emailed} />}
    </Container>
  );
}

function PersonItem({ p }: { p: PersonRow }) {
  const router = useRouter();
  const [roles, setR] = useState({ isChampion: p.isChampion, isAdmin: p.isAdmin, isPublishingSpecialist: p.isPublishingSpecialist });
  const [result, setResult] = useState<Result | null>(null);
  const [link, setLink] = useState<{ link: string; emailed?: boolean } | null>(null);
  const [email, setEmailValue] = useState(p.email ?? "");
  const [pending, start] = useTransition();
  const toggle = (key: keyof typeof roles, value: boolean) =>
    start(async () => {
      const next = { ...roles, [key]: value };
      const r = await setRoles(p.id, next);
      if (r.ok) setR(next);
      setResult(r.ok ? null : { error: r.error });
      router.refresh();
    });
  const deactivated = p.status === "DEACTIVATED";
  return (
    <div className="py-3">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <Avatar initials={p.initials} size="sm" />
          <div className="min-w-0">
            <p className="truncate text-meta font-medium text-text">
              {p.name}
              {p.isYou && <span className="ml-1.5 text-label font-normal text-text-faint">You</span>}
            </p>
            <p className="truncate text-label text-text-muted">
              {p.email ?? "No email yet"} · {deactivated ? "Deactivated" : !p.hasPassword ? "Hasn't set up access" : p.lastLogin ? `Last signed in ${p.lastLogin}` : "Never signed in"}
              {p.launching > 0 && ` · launching ${p.launching}`}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <Checkbox label="Champion" checked={roles.isChampion} disabled={pending || deactivated} onChange={(e) => toggle("isChampion", e.target.checked)} />
          <Checkbox label="Admin" checked={roles.isAdmin} disabled={pending || deactivated || p.isYou} onChange={(e) => toggle("isAdmin", e.target.checked)} />
          <Checkbox label="Publisher" checked={roles.isPublishingSpecialist} disabled={pending || deactivated} onChange={(e) => toggle("isPublishingSpecialist", e.target.checked)} />
          {!p.isYou && (
            <>
              {p.email && !deactivated && (
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={pending}
                  onClick={() =>
                    start(async () => {
                      const r = await resetAccess(p.id);
                      if (!r.ok) return setResult({ error: r.error });
                      setLink({ link: r.link!, emailed: r.emailed });
                    })
                  }
                >
                  {p.hasPassword ? "Reset access" : "Send access link"}
                </Button>
              )}
              <Button
                size="sm"
                variant={deactivated ? "secondary" : "ghost"}
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    const r = await setActive(p.id, deactivated);
                    setResult(r.ok ? null : { error: r.error });
                    router.refresh();
                  })
                }
              >
                {deactivated ? "Reactivate" : "Deactivate"}
              </Button>
            </>
          )}
        </div>
      </div>
      {!p.email && (
        <div className="mt-2 flex flex-wrap items-center gap-2 sm:pl-9">
          <div className="w-full sm:w-72">
            <TextField aria-label={`Email for ${p.name}`} placeholder="Add their work email to give them access" value={email} onChange={(e) => setEmailValue(e.target.value)} />
          </div>
          <Button
            size="sm"
            disabled={pending || !email}
            onClick={() =>
              start(async () => {
                const r = await setEmail(p.id, email);
                setResult(r.ok ? { saved: true } : { error: r.error });
                router.refresh();
              })
            }
          >
            Save email
          </Button>
        </div>
      )}
      {result && (
        <div className="mt-1 sm:pl-9">
          <Status result={result} />
        </div>
      )}
      {link && <LinkResult link={link.link} emailed={link.emailed} />}
    </div>
  );
}

export function PeopleTab({ people, invitations }: { people: PersonRow[]; invitations: InvitationRow[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <div className="space-y-4">
      <InviteForm />
      {invitations.length > 0 && (
        <Container heading="Waiting to join" count={invitations.length}>
          {invitations.map((i) => (
            <div key={i.id} className="flex flex-wrap items-center gap-3 py-3">
              <div className="min-w-0 flex-1">
                <p className="text-meta text-text">{i.name}</p>
                <p className="text-label text-text-muted">
                  {i.email} · link expires {i.expires}
                </p>
              </div>
              <Button size="sm" variant="ghost" disabled={pending} onClick={() => start(async () => { await revokeInvitation(i.id); router.refresh(); })}>
                Revoke
              </Button>
            </div>
          ))}
        </Container>
      )}
      <Container heading="People" count={people.filter((p) => p.status !== "DEACTIVATED").length}>
        {people.map((p) => (
          <PersonItem key={p.id} p={p} />
        ))}
      </Container>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Settings: organisation, momentum rules, digest and impact assumptions
// ---------------------------------------------------------------------------

const TIMES = Array.from({ length: 24 }, (_, h) => `${String(h).padStart(2, "0")}:00`);

type Rules = { approvalTimeoutDays: number; approvalNudgeDays: number; approvalEscalateDays: number; stalledBuildDays: number; unclaimedQuestionHours: number; digestTime: string; digestWeekdaysOnly: boolean };

export function SettingsTab({ org, rules, impact }: { org: { name: string; allowedEmailDomain: string; aiMonthlyLimit: number }; rules: Rules; impact: { hourlyCost: string; programmeCost: string } }) {
  const [o, setO] = useState(org);
  const [r, setRv] = useState(rules);
  const [i, setI] = useState(impact);
  const [res, setRes] = useState<Record<string, Result | null>>({});
  const [pending, start] = useTransition();
  const num = (key: Exclude<keyof Rules, "digestTime" | "digestWeekdaysOnly">) => ({ value: r[key], onChange: (e: React.ChangeEvent<HTMLInputElement>) => setRv({ ...r, [key]: Number(e.target.value) }) });
  const save = (key: string, fn: () => Promise<Result>) => start(async () => setRes({ ...res, [key]: await fn() }));
  return (
    <div className="space-y-6">
      <div>
        <Container heading="Organisation">
          <SettingRow title="Name" hint="Shown to everyone in Spine and in invitations">
            <div className="w-full sm:w-64">
              <TextField aria-label="Organisation name" value={o.name} onChange={(e) => setO({ ...o, name: e.target.value })} />
            </div>
          </SettingRow>
          <SettingRow title="Allowed email domain" hint="Optional: only invite addresses at this domain">
            <div className="w-full sm:w-64">
              <TextField aria-label="Allowed email domain" placeholder="example.com" value={o.allowedEmailDomain} onChange={(e) => setO({ ...o, allowedEmailDomain: e.target.value })} />
            </div>
          </SettingRow>
          <SettingRow title="Monthly AI allowance" hint="AI requests per calendar month. 0 turns AI features off.">
            <NumberField aria-label="Monthly AI allowance" min={0} suffix="requests" value={o.aiMonthlyLimit} onChange={(e) => setO({ ...o, aiMonthlyLimit: Number(e.target.value) })} />
          </SettingRow>
        </Container>
        <SaveBar pending={pending} result={res.org ?? null} onSave={() => save("org", () => saveOrganisation(o))} />
      </div>

      <div>
        <Container heading="Momentum" description="When Spine nudges people and flags things in Pulse.">
          <SettingRow title="Approval timeout" hint="Ideas auto-approve after this long unless an approval rule says otherwise">
            <NumberField aria-label="Approval timeout in days" min={1} suffix="days" {...num("approvalTimeoutDays")} />
          </SettingRow>
          <SettingRow title="Remind approvers" hint="Nudge whoever still has to approve after this long">
            <NumberField aria-label="Remind approvers after days" min={1} suffix="days" {...num("approvalNudgeDays")} />
          </SettingRow>
          <SettingRow title="Escalate stuck approvals" hint="When named approvers haven't decided, let any admin decide">
            <NumberField aria-label="Escalate after days" min={1} suffix="days" {...num("approvalEscalateDays")} />
          </SettingRow>
          <SettingRow title="Quiet build" hint="Flag a build with no activity for this long">
            <NumberField aria-label="Quiet build threshold in days" min={1} suffix="days" {...num("stalledBuildDays")} />
          </SettingRow>
          <SettingRow title="Unanswered question" hint="Flag an unclaimed question after this long">
            <NumberField aria-label="Unanswered question threshold in hours" min={1} suffix="hours" {...num("unclaimedQuestionHours")} />
          </SettingRow>
          <SettingRow title="Daily Pulse digest" hint="Posted to your connected Teams and Slack channels (Integrations)">
            <div className="w-28">
              <Select aria-label="Digest time" value={r.digestTime} onChange={(e) => setRv({ ...r, digestTime: e.target.value })} options={TIMES.map((t) => ({ value: t, label: t }))} />
            </div>
            <Checkbox label="Weekdays only" checked={r.digestWeekdaysOnly} onChange={(e) => setRv({ ...r, digestWeekdaysOnly: e.target.checked })} />
          </SettingRow>
        </Container>
        <SaveBar pending={pending} result={res.rules ?? null} onSave={() => save("rules", () => saveRules(r))} />
      </div>

      <div>
        <Container heading="Value assumptions" description="Used to estimate the value of verified hours saved.">
          <SettingRow title="Hourly cost" hint="Average loaded cost of an hour of work">
            <NumberField aria-label="Hourly cost in pounds" min={0} value={i.hourlyCost} onChange={(e) => setI({ ...i, hourlyCost: e.target.value })} suffix="£ an hour" />
          </SettingRow>
          <SettingRow title="Programme cost" hint="What the AI programme costs to run">
            <NumberField aria-label="Programme cost in pounds" min={0} value={i.programmeCost} onChange={(e) => setI({ ...i, programmeCost: e.target.value })} suffix="£" />
          </SettingRow>
        </Container>
        <SaveBar pending={pending} result={res.impact ?? null} onSave={() => save("impact", () => saveImpact(i))} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Topics
// ---------------------------------------------------------------------------

function TopicRow({ topic }: { topic: { id: string; name: string } }) {
  const [name, setName] = useState(topic.name);
  const [result, setResult] = useState<Result | null>(null);
  const [pending, start] = useTransition();
  const changed = name.trim() !== topic.name;
  return (
    <div className="flex flex-wrap items-center gap-2 py-2.5">
      <div className="w-full sm:w-72">
        <TextField aria-label={`Rename ${topic.name}`} value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      {changed && (
        <Button size="sm" disabled={pending} onClick={() => start(async () => setResult(await renameTopic(topic.id, name)))}>
          Rename
        </Button>
      )}
      <Button size="sm" variant="ghost" disabled={pending} onClick={() => start(async () => setResult(await removeTopic(topic.id)))}>
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
    <Container heading="Topics" description="Used to route questions to the right Champion and group initiatives. Removing a topic keeps it on old items.">
      {topics.map((t) => (
        <TopicRow key={t.id + t.name} topic={t} />
      ))}
      <div className="flex flex-wrap items-center gap-2 py-3">
        <div className="w-full sm:w-72">
          <TextField aria-label="New topic" placeholder="New topic" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <Button
          size="sm"
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
    </Container>
  );
}

// ---------------------------------------------------------------------------
// Integrations
// ---------------------------------------------------------------------------

export type ChannelState = { connected: boolean; lastAt: string | null; lastStatus: string | null };

function WebhookRow({ kind, state, ready }: { kind: "slack" | "teams"; state: ChannelState; ready: boolean }) {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [pending, start] = useTransition();
  const name = kind === "slack" ? "Slack" : "Microsoft Teams";
  return (
    <div className="py-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-meta font-medium text-text">{name}</p>
          <p className="text-label text-text-muted">
            {state.connected
              ? `Connected${state.lastAt ? ` · last post ${state.lastAt}: ${state.lastStatus === "ok" ? "delivered" : state.lastStatus}` : " · nothing posted yet"}`
              : kind === "slack"
                ? "Create an incoming webhook for the channel (Slack: Apps > Incoming Webhooks) and paste its URL."
                : "In the channel, open Workflows, set up a flow that posts webhook requests to the channel, and paste its URL."}
          </p>
        </div>
        {state.connected && (
          <Button size="sm" variant="ghost" disabled={pending} onClick={() => start(async () => { setResult(await removeWebhook(kind)); router.refresh(); })}>
            Disconnect
          </Button>
        )}
      </div>
      {(!state.connected || url) && (
        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
          <div className="min-w-0 flex-1">
            <TextField aria-label={`${name} webhook URL`} type="url" placeholder="https://" value={url} onChange={(e) => setUrl(e.target.value)} disabled={!ready} />
          </div>
          <Button
            size="sm"
            disabled={pending || !url || !ready}
            onClick={() =>
              start(async () => {
                const r = await saveWebhook(kind, url);
                setResult(r);
                if (!r.error) setUrl("");
                router.refresh();
              })
            }
          >
            Connect
          </Button>
        </div>
      )}
      {result && (
        <div className="mt-1">
          <Status result={result} />
        </div>
      )}
    </div>
  );
}

export function IntegrationsTab({ slack, teams, encryptionReady }: { slack: ChannelState; teams: ChannelState; encryptionReady: boolean }) {
  const router = useRouter();
  const [result, setResult] = useState<Result | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="space-y-4">
      {!encryptionReady && <Notice tone="warning">Connecting channels needs SPINE_ENCRYPTION_KEY on the server, so webhook URLs are stored encrypted.</Notice>}
      <Container
        heading="Team channels"
        description="Spine posts approvals waiting, blockers, initiatives looking for people and the daily Pulse digest to one channel per tool. It never reads messages."
        action={
          <Button size="sm" disabled={pending || (!slack.connected && !teams.connected)} onClick={() => start(async () => { setResult(await testChannels()); router.refresh(); })}>
            Send a test
          </Button>
        }
      >
        <WebhookRow kind="teams" state={teams} ready={encryptionReady} />
        <WebhookRow kind="slack" state={slack} ready={encryptionReady} />
      </Container>
      <Status result={result} />
      <Container heading="How the rest fits together" variant="plain">
        <ul className="space-y-2 text-meta text-text">
          <li>
            <span className="font-medium">Initiative channels: </span>
            <span className="text-text-muted">teams link the existing Teams or Slack channel they work in from the initiative page. Spine doesn't create a channel per initiative.</span>
          </li>
          <li>
            <span className="font-medium">Mentions: </span>
            <span className="text-text-muted">people add their Slack member ID in Settings, so Slack posts can @mention approvers and owners.</span>
          </li>
          <li>
            <span className="font-medium">Calendars: </span>
            <span className="text-text-muted">each initiative offers a calendar file with its milestones and next check-in. It works with Outlook and Google Calendar without any admin setup.</span>
          </li>
        </ul>
      </Container>
    </div>
  );
}
