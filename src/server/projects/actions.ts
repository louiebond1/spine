"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { parseZoned, startOfMonth } from "@/lib/tz";
import { firstName } from "@/lib/format";
import { runAiReview } from "../ai/review";
import { generateBuildPlan, generateDraftPlan, phraseForStep } from "../ai/buildPlan";
import { AI_ERROR_TEXT, classify } from "../ai/client";
import { now } from "../clock";
import { requireCtx, type Ctx } from "../ctx";
import { assert, can } from "../permissions";
import { channelLinkProblem } from "../integrations/channels";
import * as lifecycle from "./lifecycle";
import * as tell from "../notify/events";

const refresh = () => revalidatePath("/", "layout");
const DAY = 86_400_000;

// ---------------------------------------------------------------------------
// Proposing and the advisory AI review
// ---------------------------------------------------------------------------

const ideaSchema = z.object({
  title: z.string().trim().min(3).max(120),
  problem: z.string().trim().min(10).max(3000),
  whoBenefits: z.string().trim().min(2).max(200),
  topicId: z.string().min(1),
  teamSize: z.coerce.number().int().min(1).max(10),
  hoursPerWeek: z.coerce.number().int().min(1).max(10),
  lengthWeeks: z.coerce.number().int().min(1).max(12),
  difficulty: z.enum(["EASY", "MODERATE", "HARD"]),
  targetDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  successMetric: z.string().trim().max(240).default(""),
  mvpScope: z.string().trim().max(400).default(""),
});

export type ProposeState = { error?: string };

/** "Continue to review": saves the idea as a draft, then the review page runs the AI review. */
export async function saveDraft(_prev: ProposeState, form: FormData): Promise<ProposeState> {
  const ctx = await requireCtx();
  const { db, user } = ctx;
  const parsed = ideaSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: "Fill in every field to continue." };
  const { targetDate, topicId, successMetric, mvpScope, ...core } = parsed.data;
  const rest = { ...core, successMetric: successMetric || null, mvpScope: mvpScope || null };
  const useCasesRaw = String(form.get("useCases") ?? "");
  let useCases: { who: string; scenario: string; outcome: string }[] | undefined;
  try {
    const u = useCasesRaw ? JSON.parse(useCasesRaw) : undefined;
    if (Array.isArray(u)) useCases = u.slice(0, 4).map((x) => ({ who: String(x?.who ?? "").slice(0, 80), scenario: String(x?.scenario ?? "").slice(0, 400), outcome: String(x?.outcome ?? "").slice(0, 200) }));
  } catch {
    useCases = undefined;
  }
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
      db.aiReview.deleteMany({ where: { projectId: id } }),
      db.draftStep.deleteMany({ where: { projectId: id } }),
    ]);
  } else {
    const p = await db.project.create({
      data: {
        orgId: ctx.org.id,
        ...rest,
        ...(useCases ? { useCases } : {}),
        buildPath: "APP",
        topicId: topic.id,
        targetDate: target,
        ownerId: user.id,
        stage: "IDEA",
        lastActivityAt: now(),
        events: { create: { type: "CREATED", actorId: user.id, at: now() } },
      },
    });
    projectId = p.id;
    // People named when drafting: invite them (only active colleagues in this organisation).
    const wanted = [...new Set(form.getAll("invite").map(String))].filter((x) => x && x !== user.id).slice(0, 9);
    if (wanted.length) {
      const valid = await db.user.findMany({ where: { id: { in: wanted }, status: "ACTIVE" }, select: { id: true } });
      await db.projectInvite.createMany({ data: valid.map((u) => ({ projectId: p.id, userId: u.id, invitedById: user.id })), skipDuplicates: true });
      await tell.invited(ctx, p.id, valid.map((u) => u.id), user.id);
    }
    const opportunityId = String(form.get("opportunityId") ?? "");
    if (opportunityId) await db.opportunity.updateMany({ where: { id: opportunityId, status: "OPEN" }, data: { status: "PROPOSED", projectId: p.id } });
  }
  redirect(`/ideas/${projectId}/review`);
}

export async function runReview(projectId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const ctx = await requireCtx();
  const p = await ctx.db.project.findUnique({ where: { id: projectId } });
  assert(!!p && can.seeScores(ctx.user, p));
  try {
    await runAiReview(ctx, projectId);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: AI_ERROR_TEXT[classify(error)] };
  }
}

/** Scores never block submitting. */
export async function submitIdea(projectId: string) {
  const ctx = await requireCtx();
  const p = await ctx.db.project.findUnique({ where: { id: projectId } });
  assert(!!p && can.editIdea(ctx.user, p), "Only the owner can submit this idea.");
  await lifecycle.submit(ctx, projectId, ctx.user.id);
  refresh();
  redirect(`/ideas/${projectId}`);
}

export async function runDraftPlan(projectId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const ctx = await requireCtx();
  const p = await ctx.db.project.findUnique({ where: { id: projectId } });
  assert(!!p && p.ownerId === ctx.user.id && ["IDEA", "APPROVAL", "RECRUITING"].includes(p.stage));
  try {
    await generateDraftPlan(ctx, projectId);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: AI_ERROR_TEXT[classify(error)] };
  }
}

// ---------------------------------------------------------------------------
// Approval
// ---------------------------------------------------------------------------

export async function approveIdea(projectId: string) {
  const ctx = await requireCtx();
  const { db, user } = ctx;
  const p = await db.project.findUnique({ where: { id: projectId } });
  const already = p ? await db.projectApproval.findUnique({ where: { projectId_userId: { projectId, userId: user.id } } }) : null;
  assert(!!p && can.approve(user, p) && !already, "You can't approve this.");
  const r = await lifecycle.recordApproval(ctx, projectId, user.id);
  refresh();
  redirect(r.complete ? `/ideas/${projectId}` : "/");
}

export async function returnIdea(projectId: string, note: string): Promise<{ error?: string }> {
  const ctx = await requireCtx();
  const p = await ctx.db.project.findUnique({ where: { id: projectId } });
  assert(!!p && can.approve(ctx.user, p), "Only an approver can return this.");
  const text = note.trim().slice(0, 2000);
  if (!text) return { error: "Add a note for the owner." };
  await lifecycle.returnToOwner(ctx, projectId, ctx.user.id, text);
  refresh();
  redirect("/");
}

// ---------------------------------------------------------------------------
// Team, plan and launch
// ---------------------------------------------------------------------------

async function loadForTeam(projectId: string) {
  const ctx = await requireCtx();
  const p = await ctx.db.project.findUnique({ where: { id: projectId }, include: { team: true } });
  assert(!!p, "That initiative doesn't exist.");
  return { ctx, user: ctx.user, p };
}

export async function joinProject(projectId: string) {
  const { ctx, user, p } = await loadForTeam(projectId);
  assert(can.joinProject(user, p, p.team, p.teamSize), "You can't join this initiative.");
  await lifecycle.join(ctx, projectId, user.id);
  refresh();
}

export async function retryBuildPlan(projectId: string) {
  const { ctx, user, p } = await loadForTeam(projectId);
  assert(can.editPlan(user, p, p.team));
  await ctx.db.project.update({ where: { id: projectId }, data: { planStatus: "GENERATING" } });
  await generateBuildPlan(ctx, projectId);
  refresh();
}

async function assertPlanEditor(projectId: string) {
  const r = await loadForTeam(projectId);
  assert(can.editPlan(r.user, r.p, r.p.team), "Only the team can change the plan while building.");
  return r;
}

/** Loads a step only through its initiative in this organisation. */
async function stepInOrg(ctx: Ctx, stepId: string) {
  const step = await ctx.db.planStep.findUnique({ where: { id: stepId }, include: { project: { select: { orgId: true } } } });
  assert(!!step && step.project.orgId === ctx.org.id, "That step doesn't exist.");
  return step;
}

const stepSchema = z.object({
  title: z.string().trim().min(2).max(120),
  assigneeId: z.string().min(1),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export async function addStep(projectId: string, input: z.input<typeof stepSchema>): Promise<{ error?: string }> {
  const { ctx, user, p } = await assertPlanEditor(projectId);
  const parsed = stepSchema.safeParse(input);
  if (!parsed.success) return { error: "Add a title, an assignee and a due date." };
  assert(p.team.some((m) => m.userId === parsed.data.assigneeId), "Steps can only be assigned to the team.");
  const last = await ctx.db.planStep.findFirst({ where: { projectId }, orderBy: { order: "desc" } });
  const activePhrase = await phraseForStep(ctx, parsed.data.title);
  const created = await ctx.db.$transaction(async (tx) => {
    const step = await tx.planStep.create({
      data: { projectId, title: parsed.data.title, activePhrase, assigneeId: parsed.data.assigneeId, dueDate: parseZoned(parsed.data.dueDate), order: (last?.order ?? -1) + 1 },
    });
    await lifecycle.logEvent(tx, projectId, "STEP_ADDED", user.id, parsed.data.title);
    await lifecycle.touch(tx, projectId);
    return step;
  });
  await tell.stepAssigned(ctx, [created.id], user.id);
  refresh();
  return {};
}

export async function editStep(stepId: string, input: z.input<typeof stepSchema>): Promise<{ error?: string }> {
  const ctx0 = await requireCtx();
  const step = await stepInOrg(ctx0, stepId);
  const { ctx, user, p } = await assertPlanEditor(step.projectId);
  const parsed = stepSchema.safeParse(input);
  if (!parsed.success) return { error: "Add a title, an assignee and a due date." };
  assert(p.team.some((m) => m.userId === parsed.data.assigneeId), "Steps can only be assigned to the team.");
  const renamed = parsed.data.title !== step.title;
  const activePhrase = renamed ? await phraseForStep(ctx, parsed.data.title) : step.activePhrase;
  await ctx.db.$transaction(async (tx) => {
    await tx.planStep.update({ where: { id: stepId }, data: { title: parsed.data.title, activePhrase, assigneeId: parsed.data.assigneeId, dueDate: parseZoned(parsed.data.dueDate) } });
    await lifecycle.logEvent(tx, step.projectId, "STEP_EDITED", user.id, parsed.data.title);
    await lifecycle.touch(tx, step.projectId);
  });
  if (parsed.data.assigneeId !== step.assigneeId) await tell.stepAssigned(ctx, [stepId], user.id);
  refresh();
  return {};
}

export async function moveStep(stepId: string, direction: "up" | "down") {
  const ctx0 = await requireCtx();
  const step = await stepInOrg(ctx0, stepId);
  const { ctx, user } = await assertPlanEditor(step.projectId);
  const siblings = await ctx.db.planStep.findMany({ where: { projectId: step.projectId }, orderBy: { order: "asc" } });
  const i = siblings.findIndex((s) => s.id === stepId);
  const other = siblings[direction === "up" ? i - 1 : i + 1];
  if (!other) return;
  await ctx.db.$transaction(async (tx) => {
    await tx.planStep.update({ where: { id: step.id }, data: { order: other.order } });
    await tx.planStep.update({ where: { id: other.id }, data: { order: step.order } });
    await lifecycle.logEvent(tx, step.projectId, "STEP_EDITED", user.id, step.title);
    await lifecycle.touch(tx, step.projectId);
  });
  refresh();
}

export async function toggleStep(stepId: string, done: boolean) {
  const ctx0 = await requireCtx();
  const step = await stepInOrg(ctx0, stepId);
  const { ctx, user } = await assertPlanEditor(step.projectId);
  await ctx.db.$transaction(async (tx) => {
    await tx.planStep.update({ where: { id: stepId }, data: { done, doneAt: done ? now() : null } });
    await lifecycle.logEvent(tx, step.projectId, done ? "STEP_COMPLETED" : "STEP_REOPENED", user.id, step.title);
    if (done) await lifecycle.systemMessage(tx, step.projectId, `${firstName(user.name)} completed ${step.title}`);
    await lifecycle.touch(tx, step.projectId);
  });
  await lifecycle.onStepsChanged(ctx, step.projectId);
  refresh();
}

export async function markLive(projectId: string) {
  const ctx = await requireCtx();
  const p = await ctx.db.project.findUnique({ where: { id: projectId } });
  assert(!!p && can.publish(ctx.user, p), "Only the assigned publishing specialist can mark this Live.");
  await lifecycle.markLive(ctx, projectId, ctx.user.id);
  refresh();
}

// ---------------------------------------------------------------------------
// Momentum: check-ins and blockers
// ---------------------------------------------------------------------------

const checkInSchema = z
  .object({ status: z.enum(["ON_TRACK", "AT_RISK", "BLOCKED"]), note: z.string().trim().max(2000) })
  .refine((c) => c.status === "ON_TRACK" || c.note.length >= 5, { message: "Say what's at risk or what's blocking you." });

export async function checkIn(projectId: string, raw: unknown): Promise<{ ok: true } | { ok: false; error: string }> {
  const { ctx, user, p } = await loadForTeam(projectId);
  assert(can.checkIn(user, p, p.team), "Only the owner and team can check in.");
  const parsed = checkInSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the form." };
  const { status, note } = parsed.data;
  const t = now();
  const wasBlocked = !!p.blockedAt;
  await ctx.db.$transaction(async (tx) => {
    await tx.checkIn.create({ data: { projectId, authorId: user.id, status, note: note || "On track.", at: t } });
    await tx.project.update({
      where: { id: projectId },
      data: {
        lastActivityAt: t,
        nextCheckInAt: p.checkInEveryDays ? new Date(t.getTime() + p.checkInEveryDays * DAY) : null,
        ...(status === "BLOCKED" ? { blockedAt: p.blockedAt ?? t, blockerNote: note } : { blockedAt: null, blockerNote: null }),
      },
    });
    await lifecycle.logEvent(tx, projectId, status === "BLOCKED" ? "BLOCKED" : wasBlocked ? "UNBLOCKED" : "CHECKED_IN", user.id, note.slice(0, 200) || undefined);
  });
  if (status === "BLOCKED" && !wasBlocked) await tell.blocked(ctx, projectId, note, user.id);
  refresh();
  return { ok: true };
}

export async function setCheckInCadence(projectId: string, days: number | null): Promise<{ ok: boolean }> {
  const { ctx, user, p } = await loadForTeam(projectId);
  assert(p.ownerId === user.id || user.isAdmin, "Only the owner can change check-ins.");
  const d = days === null ? null : Math.min(30, Math.max(3, Math.round(days)));
  await ctx.db.project.update({ where: { id: projectId }, data: { checkInEveryDays: d, nextCheckInAt: d && p.stage === "BUILDING" ? new Date(now().getTime() + d * DAY) : null } });
  refresh();
  return { ok: true };
}

/** Link the existing Teams or Slack channel where the team works. Spine never creates one by default. */
export async function setChannelLink(projectId: string, url: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const { ctx, user, p } = await loadForTeam(projectId);
  assert(can.linkChannel(user, p, p.team), "Only the team can link a channel.");
  const clean = url.trim();
  if (clean) {
    const problem = channelLinkProblem(clean);
    if (problem) return { ok: false, error: problem };
  }
  await ctx.db.$transaction(async (tx) => {
    await tx.project.update({ where: { id: projectId }, data: { channelUrl: clean || null } });
    await lifecycle.logEvent(tx, projectId, "CHANNEL_LINKED", user.id, clean ? "Linked a channel" : "Removed the channel link");
  });
  refresh();
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Verified outcomes
// ---------------------------------------------------------------------------

const outcomeSchema = z.object({
  hours: z.number().int().min(0).max(100000),
  evidence: z.string().trim().min(10, "Say how you measured it, in a sentence.").max(1000),
});

/** The team reports this month's hours saved with how it was measured. A new report needs re-verifying. */
export async function reportOutcome(projectId: string, raw: unknown): Promise<{ ok: true } | { ok: false; error: string }> {
  const { ctx, user, p } = await loadForTeam(projectId);
  assert(p.stage === "LIVE" && can.onTeam(user, p.team), "Only the team can report outcomes on a Live initiative.");
  const parsed = outcomeSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the numbers." };
  const month = startOfMonth(now());
  const data = { hoursSaved: parsed.data.hours, evidence: parsed.data.evidence, reportedById: user.id, verifiedById: null, verifiedAt: null };
  await ctx.db.$transaction(async (tx) => {
    await tx.impactLog.upsert({ where: { projectId_month: { projectId, month } }, create: { projectId, month, ...data }, update: data });
    await lifecycle.logEvent(tx, projectId, "HOURS_LOGGED", user.id, `${parsed.data.hours} hours, awaiting verification`);
    await lifecycle.touch(tx, projectId);
  });
  refresh();
  return { ok: true };
}

/** Someone outside the team (the approver or an admin) confirms a reported outcome. */
export async function verifyOutcome(impactId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const ctx = await requireCtx();
  const log = await ctx.db.impactLog.findUnique({ where: { id: impactId }, include: { project: { include: { team: true } } } });
  if (!log || log.project.orgId !== ctx.org.id) return { ok: false, error: "That report doesn't exist." };
  assert(can.verifyOutcome(ctx.user, log.project, log.project.team, log.reportedById), "Outcomes are verified by an approver or admin outside the team.");
  if (!log.evidence) return { ok: false, error: "Ask the team to add how they measured it first." };
  await ctx.db.$transaction(async (tx) => {
    await tx.impactLog.update({ where: { id: impactId }, data: { verifiedById: ctx.user.id, verifiedAt: now() } });
    await lifecycle.logEvent(tx, log.projectId, "OUTCOME_VERIFIED", ctx.user.id, `${log.hoursSaved} hours`);
  });
  refresh();
  return { ok: true };
}
