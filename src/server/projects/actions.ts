"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { parseZoned, startOfMonth } from "@/lib/tz";
import { firstName } from "@/lib/format";
import { runAiReview } from "../ai/review";
import { generateBuildPlan, generateDraftPlan, phraseForStep } from "../ai/buildPlan";
import { now } from "../clock";
import { db } from "../db";
import { assert, can } from "../permissions";
import { getCurrentUser } from "../session";
import * as lifecycle from "./lifecycle";

const refresh = () => revalidatePath("/", "layout");

// ---------------------------------------------------------------------------
// Proposing (rule 3) and the AI review (rule 4)
// ---------------------------------------------------------------------------

const ideaSchema = z.object({
  title: z.string().trim().min(3).max(120),
  problem: z.string().trim().min(10).max(3000),
  whoBenefits: z.string().trim().min(2).max(200),
  topicId: z.string().min(1),
  buildPath: z.enum(["APP", "COWORK_NATIVE"]),
  teamSize: z.coerce.number().int().min(1).max(10),
  hoursPerWeek: z.coerce.number().int().min(1).max(10),
  lengthWeeks: z.coerce.number().int().min(1).max(12),
  difficulty: z.enum(["EASY", "MODERATE", "HARD"]),
  targetDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export type ProposeState = { error?: string };

/** "Continue to AI review": saves the idea as a draft, then the review page runs the review. */
export async function saveDraft(_prev: ProposeState, form: FormData): Promise<ProposeState> {
  const user = await getCurrentUser();
  assert(can.proposeIdea(user));
  const parsed = ideaSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: "Fill in every field to continue." };
  const { targetDate, topicId, ...rest } = parsed.data;
  const target = parseZoned(targetDate);
  if (target.getTime() <= now().getTime()) return { error: "Pick a target date in the future." };
  const topic = await db.topic.findFirst({ where: { id: topicId, archivedAt: null } });
  if (!topic) return { error: "Pick a topic." };

  const id = String(form.get("id") ?? "");
  let projectId = id;
  if (id) {
    const existing = await db.project.findUnique({ where: { id } });
    assert(!!existing && can.editIdea(user, existing), "Only the owner can edit a draft.");
    await db.$transaction([
      db.project.update({ where: { id }, data: { ...rest, topicId: topic.id, targetDate: target, lastActivityAt: now() } }),
      // Edited ideas get a fresh review.
      db.aiReview.deleteMany({ where: { projectId: id } }),
      db.draftStep.deleteMany({ where: { projectId: id } }),
    ]);
  } else {
    const p = await db.project.create({
      data: {
        ...rest,
        topicId: topic.id,
        targetDate: target,
        ownerId: user.id,
        stage: "IDEA",
        lastActivityAt: now(),
        events: { create: { type: "CREATED", actorId: user.id, at: now() } },
      },
    });
    projectId = p.id;
  }
  redirect(`/ideas/${projectId}/review`);
}

export async function runReview(projectId: string): Promise<{ ok: boolean }> {
  const user = await getCurrentUser();
  const p = await db.project.findUnique({ where: { id: projectId } });
  assert(!!p && can.seeScores(user, p));
  try {
    await runAiReview(projectId);
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

/** Rule 5. Scores never block submitting. */
export async function submitIdea(projectId: string) {
  const user = await getCurrentUser();
  const p = await db.project.findUnique({ where: { id: projectId } });
  assert(!!p && can.editIdea(user, p), "Only the owner can submit this idea.");
  await lifecycle.submit(projectId, user.id);
  refresh();
  redirect(`/ideas/${projectId}`);
}

// ---------------------------------------------------------------------------
// Approval (rule 6)
// ---------------------------------------------------------------------------

export async function approveIdea(projectId: string) {
  const user = await getCurrentUser();
  const p = await db.project.findUnique({ where: { id: projectId } });
  assert(!!p && can.approve(user, p), "Only an admin can approve this.");
  await lifecycle.approve(projectId, user.id);
  refresh();
  redirect(`/ideas/${projectId}`);
}

export async function returnIdea(projectId: string, note: string): Promise<{ error?: string }> {
  const user = await getCurrentUser();
  const p = await db.project.findUnique({ where: { id: projectId } });
  assert(!!p && can.approve(user, p), "Only an admin can return this.");
  const text = note.trim().slice(0, 2000);
  if (!text) return { error: "Add a note for the owner." };
  await lifecycle.returnToOwner(projectId, user.id, text);
  refresh();
  redirect("/");
}

// ---------------------------------------------------------------------------
// Recruiting (rule 8), building (rules 9 and 10), publishing (rule 11), Live (rule 12)
// ---------------------------------------------------------------------------

async function loadForTeam(projectId: string) {
  const user = await getCurrentUser();
  const p = await db.project.findUniqueOrThrow({ where: { id: projectId }, include: { team: true } });
  return { user, p };
}

export async function joinProject(projectId: string) {
  const { user, p } = await loadForTeam(projectId);
  assert(can.joinProject(user, p, p.team, p.teamSize), "You can't join this project.");
  await lifecycle.join(projectId, user.id);
  refresh();
}

export async function retryBuildPlan(projectId: string) {
  const { user, p } = await loadForTeam(projectId);
  assert(can.editPlan(user, p, p.team));
  await db.project.update({ where: { id: projectId }, data: { planStatus: "GENERATING" } });
  await generateBuildPlan(projectId);
  refresh();
}

async function assertPlanEditor(projectId: string) {
  const { user, p } = await loadForTeam(projectId);
  assert(can.editPlan(user, p, p.team), "Only the team can change the plan while building.");
  return { user, p };
}

const stepSchema = z.object({
  title: z.string().trim().min(2).max(120),
  assigneeId: z.string().min(1),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export async function addStep(projectId: string, input: z.input<typeof stepSchema>): Promise<{ error?: string }> {
  const { user, p } = await assertPlanEditor(projectId);
  const parsed = stepSchema.safeParse(input);
  if (!parsed.success) return { error: "Add a title, an assignee and a due date." };
  assert(p.team.some((m) => m.userId === parsed.data.assigneeId), "Steps can only be assigned to the team.");
  const last = await db.planStep.findFirst({ where: { projectId }, orderBy: { order: "desc" } });
  const activePhrase = await phraseForStep(parsed.data.title);
  await db.$transaction(async (tx) => {
    await tx.planStep.create({
      data: {
        projectId,
        title: parsed.data.title,
        activePhrase,
        assigneeId: parsed.data.assigneeId,
        dueDate: parseZoned(parsed.data.dueDate),
        order: (last?.order ?? -1) + 1,
      },
    });
    await lifecycle.logEvent(tx, projectId, "STEP_ADDED", user.id, parsed.data.title);
    await lifecycle.touch(tx, projectId);
  });
  refresh();
  return {};
}

export async function editStep(stepId: string, input: z.input<typeof stepSchema>): Promise<{ error?: string }> {
  const step = await db.planStep.findUniqueOrThrow({ where: { id: stepId } });
  const { user, p } = await assertPlanEditor(step.projectId);
  const parsed = stepSchema.safeParse(input);
  if (!parsed.success) return { error: "Add a title, an assignee and a due date." };
  assert(p.team.some((m) => m.userId === parsed.data.assigneeId), "Steps can only be assigned to the team.");
  const renamed = parsed.data.title !== step.title;
  const activePhrase = renamed ? await phraseForStep(parsed.data.title) : step.activePhrase;
  await db.$transaction(async (tx) => {
    await tx.planStep.update({
      where: { id: stepId },
      data: { title: parsed.data.title, activePhrase, assigneeId: parsed.data.assigneeId, dueDate: parseZoned(parsed.data.dueDate) },
    });
    await lifecycle.logEvent(tx, step.projectId, "STEP_EDITED", user.id, parsed.data.title);
    await lifecycle.touch(tx, step.projectId);
  });
  refresh();
  return {};
}

export async function moveStep(stepId: string, direction: "up" | "down") {
  const step = await db.planStep.findUniqueOrThrow({ where: { id: stepId } });
  const { user } = await assertPlanEditor(step.projectId);
  const siblings = await db.planStep.findMany({ where: { projectId: step.projectId }, orderBy: { order: "asc" } });
  const i = siblings.findIndex((s) => s.id === stepId);
  const j = direction === "up" ? i - 1 : i + 1;
  const other = siblings[j];
  if (!other) return;
  await db.$transaction(async (tx) => {
    await tx.planStep.update({ where: { id: step.id }, data: { order: other.order } });
    await tx.planStep.update({ where: { id: other.id }, data: { order: step.order } });
    await lifecycle.logEvent(tx, step.projectId, "STEP_EDITED", user.id, step.title);
    await lifecycle.touch(tx, step.projectId);
  });
  refresh();
}

export async function toggleStep(stepId: string, done: boolean) {
  const step = await db.planStep.findUniqueOrThrow({ where: { id: stepId }, include: { project: true } });
  const { user } = await assertPlanEditor(step.projectId);
  await db.$transaction(async (tx) => {
    await tx.planStep.update({ where: { id: stepId }, data: { done, doneAt: done ? now() : null } });
    await lifecycle.logEvent(tx, step.projectId, done ? "STEP_COMPLETED" : "STEP_REOPENED", user.id, step.title);
    if (done) await lifecycle.systemMessage(tx, step.projectId, `${firstName(user.name)} completed ${step.title}`);
    await lifecycle.touch(tx, step.projectId);
  });
  await lifecycle.onStepsChanged(step.projectId);
  refresh();
}

export async function sendProjectMessage(projectId: string, data: FormData) {
  const { user, p } = await loadForTeam(projectId);
  assert(can.onTeam(user, p.team), "Only the team can post in this chat.");
  const body = String(data.get("body") ?? "").trim().slice(0, 5000);
  if (!body) return;
  await db.$transaction(async (tx) => {
    await tx.projectMessage.create({ data: { projectId, authorId: user.id, body, sentAt: now() } });
    await lifecycle.touch(tx, projectId);
  });
  refresh();
}

export async function markLive(projectId: string) {
  const user = await getCurrentUser();
  const p = await db.project.findUnique({ where: { id: projectId } });
  assert(!!p && can.publish(user, p), "Only the assigned publishing specialist can mark this Live.");
  await lifecycle.markLive(projectId, user.id);
  refresh();
}

export async function logHoursSaved(projectId: string, hours: number): Promise<{ error?: string }> {
  const { user, p } = await loadForTeam(projectId);
  assert(p.stage === "LIVE" && can.onTeam(user, p.team), "Only the team can log hours saved.");
  if (!Number.isInteger(hours) || hours < 0 || hours > 10000) return { error: "Enter a whole number of hours." };
  const month = startOfMonth(now());
  await db.$transaction(async (tx) => {
    await tx.impactLog.upsert({
      where: { projectId_month: { projectId, month } },
      create: { projectId, month, hoursSaved: hours },
      update: { hoursSaved: hours },
    });
    await lifecycle.logEvent(tx, projectId, "HOURS_LOGGED", user.id, String(hours));
    await lifecycle.touch(tx, projectId);
  });
  refresh();
  return {};
}

/** Draft plan shown at proposal time (owner only, and only before building starts). */
export async function runDraftPlan(projectId: string): Promise<{ ok: boolean }> {
  const user = await getCurrentUser();
  const p = await db.project.findUnique({ where: { id: projectId } });
  assert(!!p && p.ownerId === user.id && ["IDEA", "APPROVAL", "RECRUITING"].includes(p.stage));
  try {
    await generateDraftPlan(projectId);
    return { ok: true };
  } catch {
    return { ok: false };
  }
}
