import { notFound } from "next/navigation";
import type { ProjectEventType } from "@prisma/client";
import { Page } from "@/components/shell/Shell";
import { PageHeader } from "@/components/ui/PageHeader";
import { MetaLine } from "@/components/ui/MetaLine";
import { Stepper } from "@/components/ui/Stepper";
import { Tabs } from "@/components/ui/Tabs";
import { Container } from "@/components/ui/Container";
import { Row } from "@/components/ui/Row";
import { Avatar } from "@/components/ui/Avatar";
import { ChatMessage } from "@/components/ui/ChatMessage";
import { EmptyState } from "@/components/ui/States";
import { NextActionLine } from "@/features/home/YourWork";
import { PlanTab } from "@/features/ideas/PlanTab";
import { DraftPlan } from "@/features/ideas/DraftPlan";
import { ProjectBrief } from "@/features/ideas/ProjectBrief";
import { SpineRecommends, type RecommendationView } from "@/features/ideas/SpineRecommends";
import { db } from "@/server/db";
import { canApply, type ActionKind } from "@/server/autopilot/engine";
import { forecast, loadAutopilotProject } from "@/server/autopilot/signals";
import { InviteAnswer, JoinButton, MarkLiveButton, ProjectComposer } from "@/features/ideas/WorkspaceTabs";
import { clockTime, dayMonth, longDate, shortDate, timeAgo } from "@/lib/format";
import { startOfDay, zonedParts } from "@/lib/tz";
import { now } from "@/server/clock";
import { can } from "@/server/permissions";
import { STAGE_LABEL, STAGE_ORDER } from "@/server/projects/lifecycle";
import { getWorkspace, type Workspace } from "@/server/projects/queries";
import { getCurrentUser } from "@/server/session";

type Tab = "plan" | "chat" | "team" | "timeline";
const TABS: Tab[] = ["plan", "chat", "team", "timeline"];

const iso = (d: Date) => {
  const p = zonedParts(d);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
};

const EVENT_TEXT: Record<ProjectEventType, (actor: string, detail: string | null) => string> = {
  CREATED: (a) => `${a} created the idea`,
  AI_REVIEWED: () => "AI review completed",
  SUBMITTED: (a) => `${a} submitted the idea`,
  RETURNED: (a) => `${a} returned it with a note`,
  APPROVED: (a) => `${a} approved it`,
  AUTO_APPROVED: () => "Auto-approved",
  PARTIALLY_APPROVED: (a, d) => `${a} approved${d ? ` (${d})` : ""}`,
  FAST_TRACKED: (_a, d) => d ?? "Fast-tracked",
  APPROVAL_NUDGED: () => "Spine reminded the approvers",
  APPROVAL_ESCALATED: () => "Approval escalated to any admin",
  IDEA_MERGED: (a, d) => `${a} joined instead of proposing ${d ?? "a similar idea"}`,
  JOINED: (a) => `${a} joined the team`,
  RECRUITED: () => "Team complete, building started",
  PLAN_GENERATED: () => "Build plan generated from the project brief",
  STEP_ADDED: (a, d) => `${a} added ${d ?? "a step"}`,
  STEP_EDITED: (a, d) => `${a} edited ${d ?? "a step"}`,
  STEP_COMPLETED: (a, d) => `${a} completed ${d ?? "a step"}`,
  STEP_REOPENED: (a, d) => `${a} reopened ${d ?? "a step"}`,
  BUILD_COMPLETED: () => "Build completed",
  PUBLISHER_ASSIGNED: (_a, d) => `Assigned to ${d ?? "a publishing specialist"} to publish`,
  WENT_LIVE: (a) => `${a} published it. It went Live`,
  HOURS_LOGGED: (a, d) => `${a} logged ${d ?? "some"} hours saved`,
};

function TimelineTab({ p, viewerId }: { p: Workspace; viewerId: string }) {
  const days = new Map<number, Workspace["events"]>();
  for (const e of p.events) {
    const key = startOfDay(e.at).getTime();
    days.set(key, [...(days.get(key) ?? []), e]);
  }
  return (
    <Container>
      {[...days.entries()].map(([day, events]) => (
        <div key={day} className="py-4">
          <p className="mb-2 text-label font-medium text-text-muted">{longDate(new Date(day))}</p>
          {events.map((e) => {
            const actor = e.actor ? (e.actor.id === viewerId ? "You" : e.actor.name) : "";
            return (
              <p key={e.id} className="flex gap-4 py-1 text-meta text-text-muted">
                <span className="w-14 shrink-0">{clockTime(e.at)}</span>
                <span>{EVENT_TEXT[e.type](actor, e.detail)}</span>
              </p>
            );
          })}
        </div>
      ))}
    </Container>
  );
}

function TeamTab({ p, canJoin, invited }: { p: Workspace; canJoin: boolean; invited: { name: string; status: string }[] }) {
  const recruiting = p.stage === "RECRUITING" || (p.stage === "BUILDING" && p.team.length < p.teamSize);
  return (
    <Container
      heading={recruiting ? `${p.team.length} of ${p.teamSize} people` : undefined}
      action={canJoin ? <JoinButton projectId={p.id} /> : undefined}
    >
      {p.team.length === 0 ? (
        <EmptyState>The team forms once the idea is approved.</EmptyState>
      ) : (
        p.team.map((m) => (
          <Row
            key={m.id}
            density="compact"
            leading={<Avatar initials={m.user.initials} />}
            title={m.user.name}
            trailing={<span className="text-meta text-text-muted">{m.userId === p.ownerId ? "Owner" : "Member"}</span>}
          />
        ))
      )}
      {invited.map((i) => (
        <Row
          key={i.name}
          density="compact"
          leading={<Avatar initials={i.name.split(" ").map((w) => w[0]).join("")} />}
          title={i.name}
          trailing={<span className="text-meta text-text-muted">{i.status === "ACCEPTED" ? "Accepted, joins when recruiting starts" : "Invited"}</span>}
        />
      ))}
    </Container>
  );
}

function ChatTab({ p, viewerId, canPost }: { p: Workspace; viewerId: string; canPost: boolean }) {
  const t = now();
  return (
    <div className="space-y-5">
      <Container>
        <div className="space-y-6 py-6">
          {p.messages.length === 0 && <EmptyState>No messages yet.</EmptyState>}
          {p.messages.map((m) =>
            m.isSystem || !m.author ? (
              <ChatMessage key={m.id} system author="" initials={null} time="" body={m.body} />
            ) : (
              <ChatMessage
                key={m.id}
                author={m.author.name}
                initials={m.author.initials}
                time={timeAgo(m.sentAt, t)}
                body={m.body}
                mine={m.authorId === viewerId}
              />
            ),
          )}
        </div>
      </Container>
      {canPost && <ProjectComposer projectId={p.id} />}
    </div>
  );
}

/** Project workspace (08). */
export default async function ProjectPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> }) {
  const [{ id }, { tab: rawTab }] = await Promise.all([params, searchParams]);
  const user = await getCurrentUser();
  const p = await getWorkspace(id, user);
  if (!p) notFound();
  const tab: Tab = TABS.includes(rawTab as Tab) ? (rawTab as Tab) : "plan";

  const order = STAGE_ORDER[p.buildPath];
  const isTeam = can.onTeam(user, p.team);
  const canJoin = can.joinProject(user, p, p.team, p.teamSize);
  const canPublish = can.publish(user, p);
  const t = now();
  const inviteRows = await db.projectInvite.findMany({ where: { projectId: p.id, status: { in: ["PENDING", "ACCEPTED"] } } });
  const inviteUsers = await db.user.findMany({ where: { id: { in: inviteRows.map((i) => i.userId) } }, select: { id: true, name: true } });
  const myInvite = inviteRows.find((i) => i.userId === user.id && i.status === "PENDING") ?? null;
  const invitedPeople = inviteRows
    .filter((i) => !p.team.some((m) => m.userId === i.userId))
    .map((i) => ({ name: inviteUsers.find((u) => u.id === i.userId)?.name ?? "Someone", status: i.status }));
  // Spine Autopilot: forecast plus open and recently applied recommendations.
  const autopilot = await loadAutopilotProject(p.id);
  const fc = autopilot ? forecast(autopilot) : null;
  const recRows = await db.recommendation.findMany({
    where: { projectId: p.id, OR: [{ status: "OPEN" }, { status: "APPLIED", appliedAt: { gte: new Date(t.getTime() - 24 * 3_600_000) } }] },
    orderBy: [{ status: "asc" }, { createdAt: "asc" }],
    take: 5,
  });
  const appliers = await db.user.findMany({ where: { id: { in: recRows.map((r) => r.appliedById).filter((x): x is string => !!x) } }, select: { id: true, name: true } });
  const steerable = { ...p, team: p.team.map((m) => ({ ...m })), steps: p.steps };
  const recs: RecommendationView[] = recRows.map((r) => ({
    id: r.id,
    headline: r.headline,
    reason: r.reason,
    status: r.status === "APPLIED" ? "APPLIED" : "OPEN",
    canApply: canApply(user, steerable, r.kind as ActionKind),
    canUndo: r.status === "APPLIED" && !!r.undo && canApply(user, steerable, r.kind as ActionKind),
    appliedBy: appliers.find((a) => a.id === r.appliedById)?.name ?? null,
  }));
  const defaultDue = iso(new Date(Math.min(p.targetDate.getTime(), t.getTime() + 7 * 86_400_000)));

  return (
    <Page>
      <PageHeader
        breadcrumb={[
          { href: "/ideas", label: "Ideas & Projects" },
          { href: `/ideas/${p.id}`, label: p.title },
        ]}
        title={p.title}
        meta={<MetaLine parts={[p.owner.name, p.topic.name, p.buildPath === "APP" ? "App" : "Cowork-native", `Target ${dayMonth(p.targetDate)}`]} />}
      />
      <div className="-mt-2 mb-7">
        <Stepper steps={order.map((s) => STAGE_LABEL[s])} current={p.stage === "LIVE" ? order.length : order.indexOf(p.stage)} />
      </div>
      <div className="mb-7 flex min-h-control items-center justify-between gap-6">
        <div>
          <NextActionLine next={p.summary.next} strong />
          {fc && (
            <p className="mt-1 text-label text-text-muted">
              Forecast at the current pace:{" "}
              {fc.daysLate > 0 ? (
                <>
                  <strong className="font-semibold text-text">about {fc.daysLate} {fc.daysLate === 1 ? "day" : "days"} late</strong> ({shortDate(fc.finishDate)})
                </>
              ) : (
                <>on track, finishing around {shortDate(fc.finishDate)}</>
              )}
            </p>
          )}
        </div>
        {canPublish && <MarkLiveButton projectId={p.id} />}
      </div>
      {["RECRUITING", "BUILDING"].includes(p.stage) && <SpineRecommends projectId={p.id} recs={recs} />}
      <Tabs
        bordered
        className="mb-5"
        active={tab}
        tabs={TABS.map((key) => ({ key, label: key.charAt(0).toUpperCase() + key.slice(1), href: `/ideas/${p.id}?tab=${key}` }))}
      />
      {tab === "plan" && (
        <ProjectBrief useCases={p.useCases} successMetric={p.successMetric} mvpScope={p.mvpScope} laterScope={p.laterScope} hoursSavedEstimate={p.hoursSavedEstimate} />
      )}
      {tab === "plan" && ["IDEA", "APPROVAL", "RECRUITING"].includes(p.stage) && (
        <DraftPlan projectId={p.id} steps={p.draftSteps} canGenerate={p.ownerId === user.id} />
      )}
      {tab === "plan" && !["IDEA", "APPROVAL", "RECRUITING"].includes(p.stage) && (
        <PlanTab
          projectId={p.id}
          stage={p.stage}
          planStatus={p.planStatus}
          canEdit={isTeam}
          defaultDue={defaultDue}
          team={p.team.map((m) => ({ id: m.userId, name: m.user.name }))}
          hours={{ show: p.stage === "LIVE", canLog: isTeam, value: p.summary.hoursThisMonth }}
          steps={p.steps.map((s) => ({
            id: s.id,
            title: s.title,
            done: s.done,
            assigneeId: s.assigneeId,
            assigneeInitials: s.assignee.initials,
            dueLabel: shortDate(s.dueDate),
            dueIso: iso(s.dueDate),
            generatedFromBrief: s.generatedFromBrief,
          }))}
        />
      )}
      {tab === "chat" && <ChatTab p={p} viewerId={user.id} canPost={isTeam} />}
      {tab === "team" && myInvite && <InviteAnswer projectId={p.id} inviter={p.owner.name} />}
      {tab === "team" && <TeamTab p={p} canJoin={canJoin && !myInvite} invited={invitedPeople} />}
      {tab === "timeline" && <TimelineTab p={p} viewerId={user.id} />}
    </Page>
  );
}
