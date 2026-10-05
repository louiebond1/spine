import "server-only";
import { after } from "next/server";
import type { BuildPath, Prisma, ProjectEventType, ProjectStage } from "@prisma/client";
import { firstName } from "@/lib/format";
import { now } from "../clock";
import { db } from "../db";
import { getSettings } from "../settings";
import { assignPublisher } from "./publishing";

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

async function ensureOwnerOnTeam(tx: Tx, projectId: string, ownerId: string) {
  await tx.teamMember.upsert({
    where: { projectId_userId: { projectId, userId: ownerId } },
    update: {},
    create: { projectId, userId: ownerId, joinedAt: now() },
  });
}

/** Rule 5: App ideas go to Approval with an auto-approve deadline; Cowork-native ideas go straight to Recruiting. */
export async function submit(projectId: string, actorId: string) {
  const settings = await getSettings();
  let startBuild = false;
  await db.$transaction(async (tx) => {
    const p = await tx.project.findUniqueOrThrow({ where: { id: projectId } });
    const t = now();
    if (p.buildPath === "APP") {
      await move(tx, p.id, "IDEA", {
        stage: "APPROVAL",
        submittedAt: t,
        autoApproveAt: new Date(t.getTime() + settings.approvalTimeoutDays * DAY),
        returnNote: null,
      });
    } else {
      await move(tx, p.id, "IDEA", { stage: "RECRUITING", submittedAt: t, returnNote: null });
      await ensureOwnerOnTeam(tx, p.id, p.ownerId);
      startBuild = (await tx.teamMember.count({ where: { projectId } })) >= p.teamSize;
    }
    await logEvent(tx, p.id, "SUBMITTED", actorId);
  });
  if (startBuild) await startBuilding(projectId);
}

/**
 * Rules 6, 7 and 10. Approving an App idea opens Recruiting. Approving a Cowork-native build
 * (already built) moves it to Publishing. `approverId` null means auto-approved.
 */
export async function approve(projectId: string, approverId: string | null) {
  let next = "recruit" as "recruit" | "publish";
  let startBuild = false;
  await db.$transaction(async (tx) => {
    const p = await tx.project.findUniqueOrThrow({ where: { id: projectId } });
    const t = now();
    next = p.buildCompletedAt ? "publish" : "recruit";
    await move(tx, p.id, "APPROVAL", {
      stage: next === "publish" ? "APPROVAL" : "RECRUITING",
      approvedAt: t,
      approvedById: approverId,
      autoApproveAt: null,
    });
    await logEvent(tx, p.id, approverId ? "APPROVED" : "AUTO_APPROVED", approverId);
    if (next === "recruit") {
      await ensureOwnerOnTeam(tx, p.id, p.ownerId);
      startBuild = (await tx.teamMember.count({ where: { projectId } })) >= p.teamSize;
    }
  });
  if (next === "publish") await toPublishing(projectId, "APPROVAL");
  if (startBuild) await startBuilding(projectId);
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
    } else {
      await move(tx, p.id, "APPROVAL", { stage: "IDEA", autoApproveAt: null, submittedAt: null, returnNote: note });
    }
    await logEvent(tx, p.id, "RETURNED", actorId, note);
  });
}

/** Rule 8: join while recruiting; when the team is full the build starts. */
export async function join(projectId: string, userId: string) {
  let full = false;
  await db.$transaction(async (tx) => {
    const p = await tx.project.findUniqueOrThrow({ where: { id: projectId }, include: { team: true } });
    if (p.stage !== "RECRUITING") throw new Error("This project isn't recruiting.");
    if (p.team.length >= p.teamSize) throw new Error("This team is full.");
    if (p.team.some((m) => m.userId === userId)) return;
    await tx.teamMember.create({ data: { projectId, userId, joinedAt: now() } });
    await logEvent(tx, projectId, "JOINED", userId);
    await touch(tx, projectId);
    full = p.team.length + 1 >= p.teamSize;
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
  const settings = await getSettings();
  const p = await db.project.findUniqueOrThrow({ where: { id: projectId } });
  if (p.buildPath === "APP") {
    await db.$transaction(async (tx) => {
      await tx.project.update({ where: { id: projectId }, data: { buildCompletedAt: now() } });
      await logEvent(tx, projectId, "BUILD_COMPLETED", null);
    });
    await toPublishing(projectId, "BUILDING");
    return;
  }
  await db.$transaction(async (tx) => {
    const t = now();
    await move(tx, projectId, "BUILDING", {
      stage: "APPROVAL",
      buildCompletedAt: t,
      autoApproveAt: new Date(t.getTime() + settings.approvalTimeoutDays * DAY),
    });
    await logEvent(tx, projectId, "BUILD_COMPLETED", null);
  });
}

/** Rule 11: publishing goes to the specialist with the lightest load. */
async function toPublishing(projectId: string, from: ProjectStage) {
  await db.$transaction(async (tx) => {
    const publisher = await assignPublisher(tx);
    await move(tx, projectId, from, {
      stage: "PUBLISHING",
      publisherId: publisher?.id ?? null,
      publishingAssignedAt: publisher ? now() : null,
    });
    if (publisher) await logEvent(tx, projectId, "PUBLISHER_ASSIGNED", null, publisher.name);
  });
}

/** Rule 11: the assigned specialist marks it Live. */
export async function markLive(projectId: string, actorId: string) {
  await db.$transaction(async (tx) => {
    await move(tx, projectId, "PUBLISHING", { stage: "LIVE", liveAt: now() });
    await logEvent(tx, projectId, "WENT_LIVE", actorId);
  });
}
