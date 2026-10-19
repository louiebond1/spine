import { notFound } from "next/navigation";
import type { ProjectEventType } from "@prisma/client";
import { AlertOctagon, CalendarPlus } from "lucide-react";
import { Page } from "@/components/shell/Shell";
import { PageHeader } from "@/components/ui/PageHeader";
import { MetaLine } from "@/components/ui/MetaLine";
import { Stepper } from "@/components/ui/Stepper";
import { Tabs } from "@/components/ui/Tabs";
import { Container } from "@/components/ui/Container";
import { Row } from "@/components/ui/Row";
import { Avatar } from "@/components/ui/Avatar";
import { EmptyState } from "@/components/ui/States";
import { StatusPill } from "@/components/ui/StatusPill";
import { ICON_STROKE } from "@/components/ui/icons";
import { NextActionLine } from "@/features/home/YourWork";
import { PlanTab } from "@/features/ideas/PlanTab";
import { DraftPlan } from "@/features/ideas/DraftPlan";
import { ProjectBrief } from "@/features/ideas/ProjectBrief";
import { CadenceSelect, CheckInForm } from "@/features/ideas/CheckIns";
import { ReportOutcomeForm, VerifyButton } from "@/features/ideas/Outcomes";
import { ChannelLink } from "@/features/ideas/ChannelLink";
import { InviteAnswer, JoinButton, MarkLiveButton } from "@/features/ideas/WorkspaceTabs";
import { clockTime, dayMonth, longDate, monthName, shortDate } from "@/lib/format";
import { startOfDay, startOfMonth, zonedParts } from "@/lib/tz";
import { now } from "@/server/clock";
import { requireCtx } from "@/server/ctx";
import { can } from "@/server/permissions";
import { channelPlatform } from "@/server/integrations/channels";
import { STAGE_LABEL, STAGES } from "@/server/projects/lifecycle";
import { getWorkspace, type Workspace } from "@/server/projects/queries";

type Tab = "plan" | "checkins" | "team" | "outcomes" | "activity";

const iso = (d: Date) => {
  const p = zonedParts(d);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
};

const EVENT_TEXT: Record<ProjectEventType, (actor: string, detail: string | null) => string> = {
  CREATED: (a) => `${a} created the idea`,
  AI_REVIEWED: () => "AI review completed",
  SUBMITTED: (a) => `${a} submitted it for approval`,
  RETURNED: (a) => `${a} returned it with a note`,
  APPROVED: (a) => `${a} approved it`,
  AUTO_APPROVED: () => "Auto-approved after the approval window",
  PARTIALLY_APPROVED: (a, d) => `${a} approved${d ? ` (${d})` : ""}`,
  FAST_TRACKED: (_a, d) => d ?? "Fast-tracked",
  APPROVAL_NUDGED: () => "Approvers were reminded",
  APPROVAL_ESCALATED: () => "Approval escalated to any admin",
  IDEA_MERGED: (a, d) => `${a} joined instead of proposing ${d ?? "a similar idea"}`,
  JOINED: (a) => `${a} joined the team`,
  RECRUITED: () => "Team complete, building started",
  PLAN_GENERATED: () => "Plan drafted by AI from the brief",
  STEP_ADDED: (a, d) => `${a} added ${d ?? "a step"}`,
  STEP_EDITED: (a, d) => `${a} edited ${d ?? "a step"}`,
  STEP_COMPLETED: (a, d) => `${a} completed ${d ?? "a step"}`,
  STEP_REOPENED: (a, d) => `${a} reopened ${d ?? "a step"}`,
  BUILD_COMPLETED: () => "Build completed",
  PUBLISHER_ASSIGNED: (_a, d) => `${d ?? "A publishing specialist"} was assigned to launch it`,
  WENT_LIVE: (a) => `${a} launched it. It's Live`,
  HOURS_LOGGED: (a, d) => `${a} reported ${d ?? "an outcome"}`,
  CHECKED_IN: (a) => `${a} checked in`,
  BLOCKED: (a, d) => `${a} reported a blocker${d ? `: ${d}` : ""}`,
  UNBLOCKED: (a) => `${a} cleared the blocker`,
  OUTCOME_VERIFIED: (a, d) => `${a} verified ${d ?? "an outcome"}`,
  CHANNEL_LINKED: (a, d) => `${a} ${d === "Removed the channel link" ? "removed the channel link" : "linked the team's channel"}`,
};

function ActivityTab({ p, viewerId }: { p: Workspace; viewerId: string }) {
  type Item = { key: string; at: Date; text: string; quiet: boolean };
  const items: Item[] = [
    ...p.events.map((e) => ({ key: e.id, at: e.at, text: EVENT_TEXT[e.type](e.actor ? (e.actor.id === viewerId ? "You" : e.actor.name) : "", e.detail), quiet: true })),
    // Notes the team kept before 2.0 (and meeting summaries) stay readable here.
    ...p.messages.filter((m) => !m.isSystem && m.author).map((m) => ({ key: m.id, at: m.sentAt, text: `${m.author!.id === viewerId ? "You" : m.author!.name}: ${m.body}`, quiet: false })),
  ].sort((a, b) => b.at.getTime() - a.at.getTime());
  const days = new Map<number, Item[]>();
  for (const it of items) {
    const key = startOfDay(it.at).getTime();
    days.set(key, [...(days.get(key) ?? []), it]);
  }
  return (
    <Container>
      {items.length === 0 && <EmptyState>Nothing yet.</EmptyState>}
      {[...days.entries()].map(([day, list]) => (
        <div key={day} className="py-3">
          <p className="mb-1.5 text-label font-medium text-text-muted">{longDate(new Date(day))}</p>
          {list.map((it) => (
            <p key={it.key} className="flex gap-3 py-0.5 text-label">
              <span className="w-12 shrink-0 text-text-faint">{clockTime(it.at)}</span>
              <span className={it.quiet ? "text-text-muted" : "whitespace-pre-line text-text"}>{it.text}</span>
            </p>
          ))}
        </div>
      ))}
    </Container>
  );
}

export default async function InitiativePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> }) {
  const [{ id }, { tab: rawTab }] = await Promise.all([params, searchParams]);
  const ctx = await requireCtx();
  const { db, user } = ctx;
  const p = await getWorkspace(ctx, id);
  if (!p) notFound();
  const t = now();

  const isTeam = can.onTeam(user, p.team);
  const canJoin = can.joinProject(user, p, p.team, p.teamSize);
  const canCheckIn = can.checkIn(user, p, p.team);
  const showOutcomes = p.stage === "LIVE" || p.impact.length > 0;
  const tabs: Tab[] = ["plan", "checkins", "team", ...(showOutcomes ? (["outcomes"] as Tab[]) : []), "activity"];
  const tab: Tab = tabs.includes(rawTab as Tab) ? (rawTab as Tab) : "plan";
  const LABEL: Record<Tab, string> = { plan: "Plan", checkins: "Check-ins", team: "Team", outcomes: "Outcomes", activity: "Activity" };

  const inviteRows = await db.projectInvite.findMany({ where: { projectId: p.id, status: { in: ["PENDING", "ACCEPTED"] } } });
  const inviteUsers = await db.user.findMany({ where: { id: { in: inviteRows.map((i) => i.userId) } }, select: { id: true, name: true, initials: true } });
  const myInvite = inviteRows.find((i) => i.userId === user.id && i.status === "PENDING") ?? null;
  const invitedPeople = inviteRows.filter((i) => !p.team.some((m) => m.userId === i.userId)).map((i) => ({ user: inviteUsers.find((u) => u.id === i.userId), status: i.status }));
  const defaultDue = iso(new Date(Math.min(p.targetDate.getTime(), t.getTime() + 7 * 86_400_000)));
  const checkInDue = p.stage === "BUILDING" && !!p.nextCheckInAt && p.nextCheckInAt <= t;
  const thisMonth = p.impact.find((i) => i.month.getTime() === startOfMonth(t).getTime());
  const fc = p.forecast;

  return (
    <Page>
      <PageHeader
        breadcrumb={[{ href: "/ideas", label: "Initiatives" }]}
        title={p.title}
        meta={<MetaLine size="label" parts={[p.owner.name, p.topic.name, `Target ${dayMonth(p.targetDate)}`]} />}
        aside={
          <>
            <ChannelLink projectId={p.id} url={p.channelUrl} platform={channelPlatform(p.channelUrl)} canEdit={can.linkChannel(user, p, p.team)} />
            {p.stage !== "IDEA" && (
              <a href={`/api/ideas/${p.id}/calendar`} className="inline-flex h-8 items-center gap-1.5 rounded-control px-2 text-label text-text-muted hover:bg-subtle hover:text-text" title="Add milestones and check-ins to your calendar">
                <CalendarPlus size={15} strokeWidth={ICON_STROKE} aria-hidden />
                <span className="sr-only sm:not-sr-only">Calendar</span>
              </a>
            )}
          </>
        }
      />
      <div className="mb-5">
        <Stepper steps={STAGES.map((s) => STAGE_LABEL[s])} current={p.stage === "LIVE" ? STAGES.length : STAGES.indexOf(p.stage)} />
      </div>
      {p.blockedAt && (
        <div className="mb-4 flex items-start gap-2.5 rounded-control border border-critical/30 bg-critical-soft px-4 py-3">
          <AlertOctagon size={16} strokeWidth={ICON_STROKE} className="mt-0.5 shrink-0 text-critical" aria-hidden />
          <p className="text-meta text-text">
            <span className="font-medium">Blocked since {shortDate(p.blockedAt)}: </span>
            {p.blockerNote}
          </p>
        </div>
      )}
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <NextActionLine next={p.summary.next} strong />
          {fc && (
            <p className="mt-0.5 text-label text-text-muted">
              At the current pace:{" "}
              {fc.daysLate > 0 ? (
                <strong className="font-semibold text-text">
                  about {fc.daysLate} {fc.daysLate === 1 ? "day" : "days"} late ({shortDate(fc.finishDate)})
                </strong>
              ) : (
                <>on track, finishing around {shortDate(fc.finishDate)}</>
              )}
            </p>
          )}
        </div>
        {can.publish(user, p) && <MarkLiveButton projectId={p.id} />}
      </div>
      <Tabs className="mb-4" active={tab} tabs={tabs.map((key) => ({ key, label: LABEL[key], href: `/ideas/${p.id}?tab=${key}` }))} />

      {tab === "plan" && (
        <div className="space-y-4">
          <ProjectBrief useCases={p.useCases} successMetric={p.successMetric} mvpScope={p.mvpScope} laterScope={p.laterScope} hoursSavedEstimate={p.hoursSavedEstimate} />
          {["IDEA", "APPROVAL", "RECRUITING"].includes(p.stage) ? (
            <DraftPlan projectId={p.id} steps={p.draftSteps} canGenerate={p.ownerId === user.id} />
          ) : (
            <PlanTab
              projectId={p.id}
              stage={p.stage}
              planStatus={p.planStatus}
              canEdit={isTeam}
              defaultDue={defaultDue}
              team={p.team.map((m) => ({ id: m.userId, name: m.user.name }))}
              steps={p.steps.map((s) => ({ id: s.id, title: s.title, done: s.done, assigneeId: s.assigneeId, assigneeInitials: s.assignee.initials, dueLabel: shortDate(s.dueDate), dueIso: iso(s.dueDate), generatedFromBrief: s.generatedFromBrief }))}
            />
          )}
        </div>
      )}

      {tab === "checkins" && (
        <div className="space-y-4">
          {canCheckIn && <CheckInForm projectId={p.id} due={checkInDue} />}
          <Container
            heading="Check-ins"
            description={p.stage === "BUILDING" ? (p.checkInEveryDays ? `Next due ${p.nextCheckInAt ? shortDate(p.nextCheckInAt) : "soon"}` : "Check-ins are off") : "Check-ins run while the team is building."}
            action={p.ownerId === user.id && p.stage === "BUILDING" ? <CadenceSelect projectId={p.id} days={p.checkInEveryDays} /> : undefined}
          >
            {p.checkIns.length === 0 ? (
              <EmptyState>No check-ins yet.</EmptyState>
            ) : (
              p.checkIns.map((c) => (
                <div key={c.id} className="py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusPill status={c.status} />
                    <span className="text-label text-text-muted">
                      {c.author.id === user.id ? "You" : c.author.name} · {shortDate(c.at)}
                    </span>
                  </div>
                  <p className="mt-1 whitespace-pre-line text-meta text-text">{c.note}</p>
                </div>
              ))
            )}
          </Container>
        </div>
      )}

      {tab === "team" && (
        <div>
          {myInvite && <InviteAnswer projectId={p.id} inviter={p.owner.name} />}
          <Container heading={`${p.team.length} of ${p.teamSize} people`} action={canJoin && !myInvite ? <JoinButton projectId={p.id} /> : undefined}>
            {p.team.length === 0 && invitedPeople.length === 0 ? (
              <EmptyState>The team forms once the idea is approved.</EmptyState>
            ) : (
              <>
                {p.team.map((m) => (
                  <Row key={m.id} density="compact" leading={<Avatar initials={m.user.initials} size="sm" />} title={m.user.name} trailing={<span className="text-label text-text-muted">{m.userId === p.ownerId ? "Owner" : "Member"}</span>} />
                ))}
                {invitedPeople.map((i, n) => (
                  <Row key={n} density="compact" leading={<Avatar initials={i.user?.initials ?? null} size="sm" />} title={i.user?.name ?? "Someone"} trailing={<span className="text-label text-text-muted">{i.status === "ACCEPTED" ? "Joins once approved" : "Invited"}</span>} />
                ))}
              </>
            )}
          </Container>
        </div>
      )}

      {tab === "outcomes" && (
        <div className="space-y-4">
          {p.successMetric && (
            <p className="text-meta text-text">
              <span className="font-medium">Success measure: </span>
              {p.successMetric}
            </p>
          )}
          {p.stage === "LIVE" && isTeam && <ReportOutcomeForm projectId={p.id} current={thisMonth && thisMonth.evidence ? { hours: thisMonth.hoursSaved, evidence: thisMonth.evidence } : null} />}
          <Container heading="Reported outcomes" description="Only verified figures count in leadership reports.">
            {p.impact.length === 0 ? (
              <EmptyState>No outcomes reported yet.</EmptyState>
            ) : (
              p.impact.map((i) => (
                <Row
                  key={i.id}
                  density="compact"
                  title={`${monthName(i.month)} ${zonedParts(i.month).year}: ${i.hoursSaved} hours saved`}
                  meta={
                    <div className="text-label text-text-muted">
                      {i.evidence ? <p className="whitespace-pre-line">{i.evidence}</p> : <p>Logged before verification existed: no measurement given.</p>}
                      <p className="mt-0.5">
                        {i.reportedById ? `Reported by ${p.people.get(i.reportedById) ?? "the team"}` : "Reported by the team"}
                        {i.verifiedAt ? ` · Verified by ${p.people.get(i.verifiedById ?? "") ?? "an approver"} on ${shortDate(i.verifiedAt)}` : " · Not verified yet"}
                      </p>
                    </div>
                  }
                  trailing={!i.verifiedAt && i.evidence && can.verifyOutcome(user, p, p.team, i.reportedById) ? <VerifyButton impactId={i.id} /> : i.verifiedAt ? <span className="text-label font-medium text-positive">Verified</span> : undefined}
                />
              ))
            )}
          </Container>
        </div>
      )}

      {tab === "activity" && <ActivityTab p={p} viewerId={user.id} />}
    </Page>
  );
}
