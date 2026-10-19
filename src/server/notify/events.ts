import "server-only";
import type { Scope } from "../ctx";
import { notify } from "./notify";
import { postToChannels } from "../integrations/channels";

// What Spine tells people, and when. Called after the change has been committed. Every lookup
// goes through the organisation's scoped client.

/** Who can approve right now: the rule's named approvers, or every admin; plus all admins once escalated. */
export async function currentApprovers(scope: Scope, projectId: string) {
  const p = await scope.db.project.findUniqueOrThrow({ where: { id: projectId }, select: { ownerId: true, approverIds: true, escalatedAt: true, approvals: { select: { userId: true } } } });
  const admins =
    p.approverIds.length === 0 || p.escalatedAt ? (await scope.db.user.findMany({ where: { isAdmin: true, status: "ACTIVE" }, select: { id: true } })).map((u) => u.id) : [];
  const done = new Set(p.approvals.map((a) => a.userId));
  return [...new Set([...p.approverIds, ...admins])].filter((id) => id !== p.ownerId && !done.has(id));
}

export async function approvalNeeded(scope: Scope, projectId: string) {
  const p = await scope.db.project.findUniqueOrThrow({ where: { id: projectId }, include: { owner: true } });
  if (p.stage !== "APPROVAL") return;
  const ids = await currentApprovers(scope, projectId);
  const href = `/ideas/${p.id}/approve`;
  await notify(scope.db, ids, { kind: "approval", title: `${p.title} needs your approval`, body: `${p.owner.name} submitted ${p.title}.`, href });
  await postToChannels(scope.db, scope.org.id, { title: `${p.title} is waiting for approval`, text: `Submitted by ${p.owner.name}.`, href, mentionUserIds: ids });
}

export async function decision(scope: Scope, projectId: string, outcome: "approved" | "returned", note?: string) {
  const p = await scope.db.project.findUniqueOrThrow({ where: { id: projectId } });
  await notify(scope.db, [p.ownerId], {
    kind: "decision",
    title: outcome === "approved" ? `${p.title} is approved` : `${p.title} was returned with a note`,
    body: outcome === "returned" ? `The note: ${note ?? ""}` : p.stage === "PUBLISHING" ? "It's on its way to launch." : "People can join now. Spine drafts the plan when the team is complete.",
    href: outcome === "returned" && p.stage === "IDEA" ? `/ideas/new?from=${p.id}` : `/ideas/${p.id}`,
  });
  if (outcome === "approved" && p.stage === "RECRUITING") {
    await postToChannels(scope.db, scope.org.id, { title: `${p.title} is approved and looking for a team`, text: p.problem.slice(0, 300), href: `/ideas/${p.id}?tab=team` });
  }
}

export async function invited(scope: Scope, projectId: string, userIds: string[], inviterId: string) {
  const [p, inviter] = await Promise.all([scope.db.project.findUniqueOrThrow({ where: { id: projectId } }), scope.db.user.findUniqueOrThrow({ where: { id: inviterId } })]);
  await notify(scope.db, userIds, { kind: "invite", title: `${inviter.name} invited you to ${p.title}`, body: p.problem, href: `/ideas/${p.id}?tab=team` }, inviterId);
}

export async function stepAssigned(scope: Scope, stepIds: string[], actorId: string | null) {
  const steps = await scope.db.planStep.findMany({ where: { id: { in: stepIds }, project: { orgId: scope.org.id } }, include: { project: true } });
  for (const s of steps) {
    await notify(scope.db, [s.assigneeId], { kind: "step", title: `New step for you: ${s.title}`, body: `On ${s.project.title}.`, href: `/ideas/${s.projectId}` }, actorId);
  }
}

export async function questionReply(scope: Scope, questionId: string, authorId: string) {
  const q = await scope.db.question.findUniqueOrThrow({ where: { id: questionId }, include: { claimer: true } });
  const other = authorId === q.askerId ? q.claimerId : q.askerId;
  const who = authorId === q.claimerId && q.claimer ? q.claimer.name : "The asker";
  await notify(scope.db, [other], { kind: "reply", title: `New reply: ${q.title}`, body: `${who} replied.`, href: `/help-desk/${q.id}` }, authorId);
}

export async function questionClaimed(scope: Scope, questionId: string, claimerId: string) {
  const q = await scope.db.question.findUniqueOrThrow({ where: { id: questionId }, include: { claimer: true } });
  await notify(scope.db, [q.askerId], { kind: "reply", title: `${q.claimer?.name ?? "A Champion"} picked up your question`, body: q.title, href: `/help-desk/${q.id}` }, claimerId);
}

export async function shareRequested(scope: Scope, questionId: string, actorId: string) {
  const q = await scope.db.question.findUniqueOrThrow({ where: { id: questionId } });
  await notify(scope.db, [q.askerId], { kind: "reply", title: `Share the answer to "${q.title}"?`, body: "Your Champion suggested sharing a short summary of the answer with the company. Nothing is shared unless you agree.", href: `/help-desk/${q.id}` }, actorId);
}

/** The build plan is ready: one note per person with how many steps are theirs. */
export async function planReady(scope: Scope, projectId: string) {
  const p = await scope.db.project.findUniqueOrThrow({ where: { id: projectId }, include: { steps: { where: { done: false } } } });
  const counts = new Map<string, number>();
  for (const s of p.steps) counts.set(s.assigneeId, (counts.get(s.assigneeId) ?? 0) + 1);
  for (const [userId, n] of counts) {
    await notify(scope.db, [userId], { kind: "step", title: `The plan for ${p.title} is ready`, body: `${n} ${n === 1 ? "step is" : "steps are"} yours.`, href: `/ideas/${p.id}` });
  }
}

/** A check-in is due: the owner hears about it in Spine, by email and in the team's channel post. */
export async function checkInDue(scope: Scope, projectId: string) {
  const p = await scope.db.project.findUniqueOrThrow({ where: { id: projectId } });
  const href = `/ideas/${p.id}?tab=checkins`;
  await notify(scope.db, [p.ownerId], { kind: "checkin", title: `Check-in due: ${p.title}`, body: "On track, at risk or blocked? It takes a minute.", href });
}

export async function blocked(scope: Scope, projectId: string, note: string, actorId: string) {
  const p = await scope.db.project.findUniqueOrThrow({ where: { id: projectId }, include: { owner: true } });
  const admins = (await scope.db.user.findMany({ where: { isAdmin: true, status: "ACTIVE" }, select: { id: true } })).map((u) => u.id);
  const ids = [...new Set([p.approvedById, ...admins])];
  await notify(scope.db, ids, { kind: "nudge", title: `${p.title} is blocked`, body: note, href: `/ideas/${p.id}?tab=checkins` }, actorId);
  await postToChannels(scope.db, scope.org.id, { title: `${p.title} is blocked`, text: note, href: `/ideas/${p.id}?tab=checkins`, mentionUserIds: [p.ownerId] });
}
