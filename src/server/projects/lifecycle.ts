import "server-only";
import { after } from "next/server";
import type { ProjectEventType, ProjectStage, Prisma } from "@prisma/client";
import { firstName } from "@/lib/format";
import { now } from "../clock";
import type { Scope } from "../ctx";
import type { Tx } from "../tenant";
import { assignPublisher } from "./publishing";
import { enterApproval } from "../approvals/rules";
import * as tell from "../notify/events";

// The only module that changes Project.stage. Spine 2.0 has one lifecycle for every initiative:
// Draft > Approval > Forming team > Building > Launching > Live. Initiatives created before 2.0
// as "Cowork-native" and already built keep their place: approving them goes straight to Launching.

export const STAGES: ProjectStage[] = ["IDEA", "APPROVAL", "RECRUITING", "BUILDING", "PUBLISHING", "LIVE"];

export const STAGE_LABEL: Record<ProjectStage, string> = {
  IDEA: "Draft",
  APPROVAL: "Approval",
  RECRUITING: "Forming team",
  BUILDING: "Building",
  PUBLISHING: "Launching",
  LIVE: "Live",
};

const DAY = 24 * 3_600_000;

export async function logEvent(tx: Tx, projectId: string, type: ProjectEventType, actorId: string | null, detail?: string) {
  await tx.projectEvent.create({ data: { projectId, type, actorId, detail: detail ?? null, at: now() } });
}

export async function systemMessage(tx: Tx, projectId: string, body: string) {
  await tx.projectMessage.create({ data: { projectId, authorId: null, body, isSystem: true, sentAt: now() } });
}

/** Records activity so "Build going quiet" and "Your work" stay accurate. */
export async function touch(tx: Tx, projectId: string) {
  await tx.project.update({ where: { id: projectId }, data: { lastActivityAt: now() } });
}

/** Moves a project only if it is still in the expected stage (guards double clicks and races). */
async function move(tx: Tx, projectId: string, from: ProjectStage, data: Prisma.ProjectUncheckedUpdateManyInput) {
  const { count } = await tx.project.updateMany({ where: { id: projectId, stage: from }, data: { ...data, lastActivityAt: now() } });
  if (count !== 1) throw new Error("This initiative has already moved on.");
}

/** Row lock so concurrent joins and approvals on one project run one at a time. */
async function lockProject(tx: Tx, projectId: string) {
  await tx.$queryRaw`SELECT id FROM "Project" WHERE id = ${projectId} FOR UPDATE`;
}

async function addAcceptedInvitees(tx: Tx, projectId: string, teamSize: number) {
  const invites = await tx.projectInvite.findMany({ where: { projectId, status: "ACCEPTED" }, orderBy: { updatedAt: "asc" } });
  for (const inv of invites) {
    const count = await tx.teamMember.count({ where: { projectId } });
    if (count >= teamSize) break;
    const exists = await tx.teamMember.findUnique({ where: { projectId_userId: { projectId, userId: inv.userId } } });
    if (exists) continue;
    await tx.teamMember.create({ data: { projectId, userId: inv.userId, joinedAt: now() } });
    await logEvent(tx, projectId, "JOINED", inv.userId, "Accepted invite");
  }
}

async function ensureOwnerOnTeam(tx: Tx, projectId: string, ownerId: string) {
  await tx.teamMember.upsert({
    where: { projectId_userId: { projectId, userId: ownerId } },
    update: {},
    create: { projectId, userId: ownerId, joinedAt: now() },
  });
}

/** Submitting sends every initiative to Approval, routed by the matching approval rule. */
export async function submit(scope: Scope, projectId: string, actorId: string) {
  let fastTrack: string | null = null;
  await scope.db.$transaction(async (tx) => {
    const p = await tx.project.findUniqueOrThrow({ where: { id: projectId } });
    const t = now();
    const { route, data } = await enterApproval(tx, p, t);
    await move(tx, p.id, "IDEA", { stage: "APPROVAL", submittedAt: t, returnNote: null, buildPath: "APP", ...data });
    if (route.fastTrack) fastTrack = route.ruleName;
    await logEvent(tx, p.id, "SUBMITTED", actorId);
  });
  if (fastTrack !== null) return approve(scope, projectId, null, `Fast-tracked by the rule "${fastTrack}"`);
  await tell.approvalNeeded(scope, projectId);
}

/**
 * Approving opens team forming. A pre-2.0 Cowork-native initiative that was already built goes
 * straight to Launching. `approverId` null means auto-approved or fast-tracked.
 */
export async function approve(scope: Scope, projectId: string, approverId: string | null, fastTrackedBy?: string) {
  let startBuild = false;
  await scope.db.$transaction(async (tx) => {
    await lockProject(tx, projectId);
    const p = await tx.project.findUniqueOrThrow({ where: { id: projectId } });
    const approval = { approvedAt: now(), approvedById: approverId, autoApproveAt: null };
    await tx.projectApproval.deleteMany({ where: { projectId } });
    const type = approverId ? "APPROVED" : fastTrackedBy ? "FAST_TRACKED" : "AUTO_APPROVED";
    if (p.buildCompletedAt) {
      await logEvent(tx, p.id, type, approverId, fastTrackedBy);
      await publishWithin(tx, p.id, "APPROVAL", approval);
    } else {
      await move(tx, p.id, "APPROVAL", { stage: "RECRUITING", ...approval });
      await logEvent(tx, p.id, type, approverId, fastTrackedBy);
      await ensureOwnerOnTeam(tx, p.id, p.ownerId);
      await addAcceptedInvitees(tx, p.id, p.teamSize);
      startBuild = (await tx.teamMember.count({ where: { projectId } })) >= p.teamSize;
    }
  });
  await tell.decision(scope, projectId, "approved");
  if (startBuild) await startBuilding(scope, projectId);
}

/** Records one approver's sign-off; the last required approval moves it on. */
export async function recordApproval(scope: Scope, projectId: string, userId: string): Promise<{ complete: boolean; count: number; needed: number }> {
  const result = await scope.db.$transaction(async (tx) => {
    await lockProject(tx, projectId);
    const p = await tx.project.findUniqueOrThrow({ where: { id: projectId } });
    if (p.stage !== "APPROVAL") throw new Error("This idea isn't waiting for approval any more.");
    await tx.projectApproval.upsert({
      where: { projectId_userId: { projectId, userId } },
      update: {},
      create: { projectId, userId, at: now() },
    });
    const count = await tx.projectApproval.count({ where: { projectId } });
    // Once escalated, an admin who wasn't named decides on their own.
    const override = !!p.escalatedAt && !p.approverIds.includes(userId);
    const needed = override ? count : Math.max(1, p.approvalsNeeded);
    if (count < needed) {
      const actor = await tx.user.findUniqueOrThrow({ where: { id: userId } });
      await logEvent(tx, projectId, "PARTIALLY_APPROVED", userId, `${count} of ${needed}`);
      await systemMessage(tx, projectId, `${firstName(actor.name)} approved this (${count} of ${needed} approvals)`);
      await touch(tx, projectId);
    }
    return { complete: count >= needed, count, needed };
  });
  if (result.complete) await approve(scope, projectId, userId);
  return result;
}

/** Return with note: back to the owner as a draft (or, for an already-built initiative, back to Building). */
export async function returnToOwner(scope: Scope, projectId: string, actorId: string, note: string) {
  await scope.db.$transaction(async (tx) => {
    const p = await tx.project.findUniqueOrThrow({ where: { id: projectId } });
    if (p.buildCompletedAt) {
      await move(tx, p.id, "APPROVAL", { stage: "BUILDING", autoApproveAt: null, buildCompletedAt: null, returnNote: note, nextCheckInAt: new Date(now().getTime() + 7 * DAY) });
      const actor = await tx.user.findUniqueOrThrow({ where: { id: actorId } });
      await systemMessage(tx, p.id, `${firstName(actor.name)} returned this with a note: ${note}`);
      const last = await tx.planStep.findFirst({ where: { projectId: p.id }, orderBy: { order: "desc" } });
      await tx.planStep.create({
        data: { projectId: p.id, title: "Address the approval note", activePhrase: "addressing the approval note", assigneeId: p.ownerId, dueDate: new Date(now().getTime() + 3 * DAY), order: (last?.order ?? -1) + 1 },
      });
    } else {
      await move(tx, p.id, "APPROVAL", { stage: "IDEA", autoApproveAt: null, submittedAt: null, returnNote: note });
    }
    await logEvent(tx, p.id, "RETURNED", actorId, note);
  });
  await tell.decision(scope, projectId, "returned", note);
}

/** Join while forming the team (or into an open spot while building); a full team starts the build. */
export async function join(scope: Scope, projectId: string, userId: string) {
  let full = false;
  await scope.db.$transaction(async (tx) => {
    await lockProject(tx, projectId);
    const p = await tx.project.findUniqueOrThrow({ where: { id: projectId }, include: { team: true } });
    if (p.stage !== "RECRUITING" && p.stage !== "BUILDING") throw new Error("This initiative isn't taking new members.");
    if (p.team.length >= p.teamSize) throw new Error("This team is full.");
    if (p.team.some((m) => m.userId === userId)) return;
    await tx.teamMember.create({ data: { projectId, userId, joinedAt: now() } });
    await logEvent(tx, projectId, "JOINED", userId);
    await touch(tx, projectId);
    full = p.stage === "RECRUITING" && p.team.length + 1 >= p.teamSize;
  });
  if (full) await startBuilding(scope, projectId);
}

/** Team complete: Building starts, check-ins are scheduled, and Claude drafts the plan in the background. */
export async function startBuilding(scope: Scope, projectId: string) {
  await scope.db.$transaction(async (tx) => {
    const p = await tx.project.findUniqueOrThrow({ where: { id: projectId }, select: { checkInEveryDays: true } });
    await move(tx, projectId, "RECRUITING", {
      stage: "BUILDING",
      planStatus: "GENERATING",
      nextCheckInAt: p.checkInEveryDays ? new Date(now().getTime() + p.checkInEveryDays * DAY) : null,
    });
    await logEvent(tx, projectId, "RECRUITED", null);
  });
  const { generateBuildPlan } = await import("../ai/buildPlan");
  try {
    after(() => generateBuildPlan(scope, projectId));
  } catch {
    await generateBuildPlan(scope, projectId);
  }
}

/** Called after any plan change. When every step is done the build is finished and goes to Launching. */
export async function onStepsChanged(scope: Scope, projectId: string) {
  const p = await scope.db.project.findUniqueOrThrow({ where: { id: projectId }, include: { steps: { select: { done: true } } } });
  if (p.stage !== "BUILDING" || p.steps.length === 0 || p.steps.some((s) => !s.done)) return;
  await scope.db.$transaction(async (tx) => {
    await logEvent(tx, projectId, "BUILD_COMPLETED", null);
    await publishWithin(tx, projectId, "BUILDING", { buildCompletedAt: now(), blockedAt: null, blockerNote: null, nextCheckInAt: null });
  });
}

/** Serialises publisher choice so two projects can't both see the same lightest load. */
async function lockPublishing(tx: Tx) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(7311)`;
}

async function publishWithin(tx: Tx, projectId: string, from: ProjectStage, extra: Prisma.ProjectUncheckedUpdateManyInput = {}) {
  await lockPublishing(tx);
  const publisher = await assignPublisher(tx);
  await move(tx, projectId, from, { ...extra, stage: "PUBLISHING", publisherId: publisher?.id ?? null, publishingAssignedAt: publisher ? now() : null });
  if (publisher) await logEvent(tx, projectId, "PUBLISHER_ASSIGNED", null, publisher.name);
}

/** Hands out initiatives that reached Launching while nobody held the publishing role. */
export async function assignUnassignedPublishing(scope: Scope) {
  const waiting = await scope.db.project.findMany({ where: { stage: "PUBLISHING", publisherId: null }, orderBy: { lastActivityAt: "asc" }, select: { id: true } });
  for (const p of waiting) {
    await scope.db.$transaction(async (tx) => {
      await lockPublishing(tx);
      const publisher = await assignPublisher(tx);
      if (!publisher) return;
      const { count } = await tx.project.updateMany({ where: { id: p.id, stage: "PUBLISHING", publisherId: null }, data: { publisherId: publisher.id, publishingAssignedAt: now() } });
      if (count === 1) await logEvent(tx, p.id, "PUBLISHER_ASSIGNED", null, publisher.name);
    });
  }
}

/** The assigned publisher marks it Live. */
export async function markLive(scope: Scope, projectId: string, actorId: string) {
  await scope.db.$transaction(async (tx) => {
    await move(tx, projectId, "PUBLISHING", { stage: "LIVE", liveAt: now() });
    await logEvent(tx, projectId, "WENT_LIVE", actorId);
  });
}
