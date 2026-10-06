import "server-only";
import { after } from "next/server";
import type { BuildPath, Prisma, ProjectEventType, ProjectStage } from "@prisma/client";
import { firstName } from "@/lib/format";
import { now } from "../clock";
import { db } from "../db";
import { assignPublisher } from "./publishing";
import { enterApproval } from "../approvals/rules";
import * as tell from "../notify/events";

// The only module that changes Project.stage. CLAUDE.md section 7, Ideas & Projects rules 1 to 11.

export const STAGE_ORDER: Record<BuildPath, ProjectStage[]> = {
  APP: ["IDEA", "APPROVAL", "RECRUITING", "BUILDING", "PUBLISHING", "LIVE"],
  COWORK_NATIVE: ["IDEA", "RECRUITING", "BUILDING", "APPROVAL", "PUBLISHING", "LIVE"],
};

export const STAGE_LABEL: Record<ProjectStage, string> = {
  IDEA: "Idea",
  APPROVAL: "Approval",
  RECRUITING: "Recruiting",
  BUILDING: "Building",
  PUBLISHING: "Publishing",
  LIVE: "Live",
};

const DAY = 24 * 3_600_000;

type Tx = Prisma.TransactionClient;

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
  if (count !== 1) throw new Error("This project has already moved on.");
}

/** Row lock so concurrent joins and approvals on one project run one at a time. */
async function lockProject(tx: Tx, projectId: string) {
  await tx.$queryRaw`SELECT id FROM "Project" WHERE id = ${projectId} FOR UPDATE`;
}

/** People who accepted a "Start with Spine" invite join as soon as recruiting starts. */
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

/** Rule 5: App ideas go to Approval with an auto-approve deadline; Cowork-native ideas go straight to Recruiting. */
export async function submit(projectId: string, actorId: string) {
  let startBuild = false;
  let fastTrack: string | null = null;
  await db.$transaction(async (tx) => {
    const p = await tx.project.findUniqueOrThrow({ where: { id: projectId } });
    const t = now();
    if (p.buildPath === "APP") {
      const { route, data } = await enterApproval(tx, p, t);
      await move(tx, p.id, "IDEA", { stage: "APPROVAL", submittedAt: t, returnNote: null, ...data });
      if (route.fastTrack) fastTrack = route.ruleName;
    } else {
      await move(tx, p.id, "IDEA", { stage: "RECRUITING", submittedAt: t, returnNote: null });
      await ensureOwnerOnTeam(tx, p.id, p.ownerId);
      await addAcceptedInvitees(tx, p.id, p.teamSize);
      startBuild = (await tx.teamMember.count({ where: { projectId } })) >= p.teamSize;
    }
    await logEvent(tx, p.id, "SUBMITTED", actorId);
  });
  if (fastTrack !== null) return approve(projectId, null, `Fast-tracked by the rule "${fastTrack}"`);
  await tell.approvalNeeded(projectId);
  if (startBuild) await startBuilding(projectId);
}

/**
 * Rules 6, 7 and 10. Approving an App idea opens Recruiting. Approving a Cowork-native build
 * (already built) moves it to Publishing. `approverId` null means auto-approved.
 */
export async function approve(projectId: string, approverId: string | null, fastTrackedBy?: string) {
  let startBuild = false;
  await db.$transaction(async (tx) => {
    await lockProject(tx, projectId);
    const p = await tx.project.findUniqueOrThrow({ where: { id: projectId } });
    const approval = { approvedAt: now(), approvedById: approverId, autoApproveAt: null };
    await tx.projectApproval.deleteMany({ where: { projectId } });
    if (p.buildCompletedAt) {
      // Cowork-native, already built: approval and publisher assignment happen together.
      await logEvent(tx, p.id, approverId ? "APPROVED" : fastTrackedBy ? "FAST_TRACKED" : "AUTO_APPROVED", approverId, fastTrackedBy);
      await publishWithin(tx, p.id, "APPROVAL", approval);
    } else {
      await move(tx, p.id, "APPROVAL", { stage: "RECRUITING", ...approval });
      await logEvent(tx, p.id, approverId ? "APPROVED" : fastTrackedBy ? "FAST_TRACKED" : "AUTO_APPROVED", approverId, fastTrackedBy);
      await ensureOwnerOnTeam(tx, p.id, p.ownerId);
      await addAcceptedInvitees(tx, p.id, p.teamSize);
      startBuild = (await tx.teamMember.count({ where: { projectId } })) >= p.teamSize;
    }
  });
  await tell.decision(projectId, "approved");
  if (startBuild) await startBuilding(projectId);
}

/**
 * Records one approver's sign-off. When a rule needs several approvers, the idea stays in
 * Approval until enough have approved; the last one moves it on. Returns how many are in.
 */
export async function recordApproval(projectId: string, userId: string): Promise<{ complete: boolean; count: number; needed: number }> {
  const result = await db.$transaction(async (tx) => {
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
  if (result.complete) await approve(projectId, userId);
  return result;
}

/**
 * Rule 6: Return with note. App ideas (and Cowork-native ideas before building) go back to the
 * owner as a draft with the note. A Cowork-native build returned after building goes back to
 * Building with the note in Chat, so the team and plan are kept (PLAN.md Q17).
 */
export async function returnToOwner(projectId: string, actorId: string, note: string) {
  await db.$transaction(async (tx) => {
    const p = await tx.project.findUniqueOrThrow({ where: { id: projectId }, include: { approvedBy: true } });
    if (p.buildCompletedAt) {
      await move(tx, p.id, "APPROVAL", { stage: "BUILDING", autoApproveAt: null, buildCompletedAt: null, returnNote: note });
      const actor = await tx.user.findUniqueOrThrow({ where: { id: actorId } });
      await systemMessage(tx, p.id, `${firstName(actor.name)} returned this with a note: ${note}`);
      // Every step is already done, so add one open step for the note. Ticking it finishes the
      // build again and sends it back to Approval.
      const last = await tx.planStep.findFirst({ where: { projectId: p.id }, orderBy: { order: "desc" } });
      await tx.planStep.create({
        data: {
          projectId: p.id,
          title: "Address the approval note",
          activePhrase: "addressing the approval note",
          assigneeId: p.ownerId,
          dueDate: new Date(now().getTime() + 3 * DAY),
          order: (last?.order ?? -1) + 1,
        },
      });
    } else {
      await move(tx, p.id, "APPROVAL", { stage: "IDEA", autoApproveAt: null, submittedAt: null, returnNote: note });
    }
    await logEvent(tx, p.id, "RETURNED", actorId, note);
  });
  await tell.decision(projectId, "returned", note);
}

/** Rule 8: join while recruiting; when the team is full the build starts. */
export async function join(projectId: string, userId: string) {
  let full = false;
  await db.$transaction(async (tx) => {
    // Lock first so two people can't both take the last place.
    await lockProject(tx, projectId);
    const p = await tx.project.findUniqueOrThrow({ where: { id: projectId }, include: { team: true } });
    if (p.stage !== "RECRUITING" && p.stage !== "BUILDING") throw new Error("This project isn't taking new members.");
    if (p.team.length >= p.teamSize) throw new Error("This team is full.");
    if (p.team.some((m) => m.userId === userId)) return;
    await tx.teamMember.create({ data: { projectId, userId, joinedAt: now() } });
    await logEvent(tx, projectId, "JOINED", userId);
    await touch(tx, projectId);
    // Joining an open spot during Building just adds the person; the plan is already running.
    full = p.stage === "RECRUITING" && p.team.length + 1 >= p.teamSize;
  });
  if (full) await startBuilding(projectId);
}

/** Rule 8: team full, so Building starts and Claude writes the plan in the background. */
export async function startBuilding(projectId: string) {
  await db.$transaction(async (tx) => {
    await move(tx, projectId, "RECRUITING", { stage: "BUILDING", planStatus: "GENERATING" });
    await logEvent(tx, projectId, "RECRUITED", null);
  });
  const { generateBuildPlan } = await import("../ai/buildPlan");
  try {
    // Inside a request: generate after the response so joining never waits on the AI.
    after(() => generateBuildPlan(projectId));
  } catch {
    // Outside a request (the daily job): generate now.
    await generateBuildPlan(projectId);
  }
}

/** Rule 10: called after any plan change. When every step is done the build is finished. */
export async function onStepsChanged(projectId: string) {
  const p = await db.project.findUniqueOrThrow({ where: { id: projectId }, include: { steps: { select: { done: true } } } });
  if (p.stage !== "BUILDING" || p.steps.length === 0 || p.steps.some((s) => !s.done)) return;
  await completeBuild(projectId);
}

async function completeBuild(projectId: string) {
  const p = await db.project.findUniqueOrThrow({ where: { id: projectId } });
  if (p.buildPath === "APP") {
    await db.$transaction(async (tx) => {
      await logEvent(tx, projectId, "BUILD_COMPLETED", null);
      await publishWithin(tx, projectId, "BUILDING", { buildCompletedAt: now() });
    });
    return;
  }
  let fastTrack: string | null = null;
  await db.$transaction(async (tx) => {
    const t = now();
    const { route, data } = await enterApproval(tx, p, t);
    await move(tx, projectId, "BUILDING", { stage: "APPROVAL", buildCompletedAt: t, ...data });
    await logEvent(tx, projectId, "BUILD_COMPLETED", null);
    if (route.fastTrack) fastTrack = route.ruleName;
  });
  if (fastTrack !== null) await approve(projectId, null, `Fast-tracked by the rule "${fastTrack}"`);
  else await tell.approvalNeeded(projectId);
}

/** Serialises publisher choice so two projects can't both see the same lightest load. */
async function lockPublishing(tx: Tx) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(7311)`;
}

/** Rule 11: publishing goes to the specialist with the lightest load, inside the caller's transaction. */
async function publishWithin(tx: Tx, projectId: string, from: ProjectStage, extra: Prisma.ProjectUncheckedUpdateManyInput = {}) {
  await lockPublishing(tx);
  const publisher = await assignPublisher(tx);
  await move(tx, projectId, from, {
    ...extra,
    stage: "PUBLISHING",
    publisherId: publisher?.id ?? null,
    publishingAssignedAt: publisher ? now() : null,
  });
  if (publisher) await logEvent(tx, projectId, "PUBLISHER_ASSIGNED", null, publisher.name);
}

/**
 * Projects that reached Publishing while nobody was a publishing specialist wait unassigned;
 * this hands them out as soon as someone is given the role.
 */
export async function assignUnassignedPublishing() {
  const waiting = await db.project.findMany({
    where: { stage: "PUBLISHING", publisherId: null },
    orderBy: { lastActivityAt: "asc" },
    select: { id: true },
  });
  for (const p of waiting) {
    await db.$transaction(async (tx) => {
      await lockPublishing(tx);
      const publisher = await assignPublisher(tx);
      if (!publisher) return;
      const { count } = await tx.project.updateMany({
        where: { id: p.id, stage: "PUBLISHING", publisherId: null },
        data: { publisherId: publisher.id, publishingAssignedAt: now() },
      });
      if (count === 1) await logEvent(tx, p.id, "PUBLISHER_ASSIGNED", null, publisher.name);
    });
  }
}

/** Rule 11: the assigned specialist marks it Live. */
export async function markLive(projectId: string, actorId: string) {
  await db.$transaction(async (tx) => {
    await move(tx, projectId, "PUBLISHING", { stage: "LIVE", liveAt: now() });
    await logEvent(tx, projectId, "WENT_LIVE", actorId);
  });
}
