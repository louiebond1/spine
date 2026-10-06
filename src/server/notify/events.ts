import "server-only";
import { db } from "../db";
import { notify, postToSlack } from "./notify";

// What Spine tells people, and when. Called after the change has been committed.

/** Who can approve right now: the rule's named approvers, or every admin; plus all admins once escalated. */
export async function currentApprovers(projectId: string) {
  const p = await db.project.findUniqueOrThrow({ where: { id: projectId }, select: { ownerId: true, approverIds: true, escalatedAt: true, approvals: { select: { userId: true } } } });
  const admins = p.approverIds.length === 0 || p.escalatedAt ? (await db.user.findMany({ where: { isAdmin: true }, select: { id: true } })).map((u) => u.id) : [];
  const done = new Set(p.approvals.map((a) => a.userId));
  return [...new Set([...p.approverIds, ...admins])].filter((id) => id !== p.ownerId && !done.has(id));
}

export async function approvalNeeded(projectId: string) {
  const p = await db.project.findUniqueOrThrow({ where: { id: projectId }, include: { owner: true } });
  if (p.stage !== "APPROVAL") return;
  const ids = await currentApprovers(projectId);
  const href = `/ideas/${p.id}/approve`;
  await notify(ids, { kind: "approval", title: `${p.title} needs your approval`, body: `${p.owner.name} submitted ${p.title}. Spine has written an approval brief to help you decide.`, href });
  const names = (await db.user.findMany({ where: { id: { in: ids } }, select: { name: true } })).map((u) => u.name);
  const url = (process.env.SPINE_APP_URL ?? "").replace(/\/$/, "");
  await postToSlack(`*${url ? `<${url}${href}|${p.title}>` : p.title}* is waiting for approval${names.length ? ` from ${names.join(", ")}` : ""}.`);
}

export async function decision(projectId: string, outcome: "approved" | "returned", note?: string) {
  const p = await db.project.findUniqueOrThrow({ where: { id: projectId } });
  await notify([p.ownerId], {
    kind: "decision",
    title: outcome === "approved" ? `${p.title} is approved` : `${p.title} was returned with a note`,
    body: outcome === "returned" ? `The note: ${note ?? ""}` : p.stage === "PUBLISHING" ? "It's on its way to publishing." : "It's open for people to join. Spine builds the plan when the team is full.",
    href: outcome === "approved" ? `/ideas/${p.id}` : p.stage === "IDEA" ? `/ideas/new?from=${p.id}` : `/ideas/${p.id}`,
  });
}

export async function invited(projectId: string, userIds: string[], inviterId: string) {
  const [p, inviter] = await Promise.all([db.project.findUniqueOrThrow({ where: { id: projectId } }), db.user.findUniqueOrThrow({ where: { id: inviterId } })]);
  await notify(userIds, { kind: "invite", title: `${inviter.name} invited you to ${p.title}`, body: p.problem, href: `/ideas/${p.id}?tab=team` }, inviterId);
}

export async function stepAssigned(stepIds: string[], actorId: string | null) {
  const steps = await db.planStep.findMany({ where: { id: { in: stepIds } }, include: { project: true } });
  for (const s of steps) {
    await notify([s.assigneeId], { kind: "step", title: `New step for you: ${s.title}`, body: `On ${s.project.title}.`, href: `/ideas/${s.projectId}` }, actorId);
  }
}

export async function questionReply(questionId: string, authorId: string) {
  const q = await db.question.findUniqueOrThrow({ where: { id: questionId }, include: { claimer: true } });
  const other = authorId === q.askerId ? q.claimerId : q.askerId;
  const who = authorId === q.claimerId && q.claimer ? q.claimer.name : "The asker";
  await notify([other], { kind: "reply", title: `New reply: ${q.title}`, body: `${who} replied.`, href: `/help-desk/${q.id}` }, authorId);
}

export async function questionClaimed(questionId: string, claimerId: string) {
  const q = await db.question.findUniqueOrThrow({ where: { id: questionId }, include: { claimer: true } });
  await notify([q.askerId], { kind: "reply", title: `${q.claimer?.name ?? "A Champion"} picked up your question`, body: q.title, href: `/help-desk/${q.id}` }, claimerId);
}

/** The build plan is ready: one note per person with how many steps are theirs. */
export async function planReady(projectId: string) {
  const p = await db.project.findUniqueOrThrow({ where: { id: projectId }, include: { steps: { where: { done: false } } } });
  const counts = new Map<string, number>();
  for (const s of p.steps) counts.set(s.assigneeId, (counts.get(s.assigneeId) ?? 0) + 1);
  for (const [userId, n] of counts) {
    await notify([userId], { kind: "step", title: `The plan for ${p.title} is ready`, body: `${n} ${n === 1 ? "step is" : "steps are"} yours.`, href: `/ideas/${p.id}` });
  }
}
