import "server-only";
import type { Prisma, User } from "@prisma/client";
import { z } from "zod";
import { firstName, shortDate } from "@/lib/format";
import { parseZoned } from "@/lib/tz";
import { now } from "../clock";
import { db } from "../db";
import { logEvent, startBuilding, systemMessage, touch } from "../projects/lifecycle";

// Spine Autopilot, part 2: act. Each kind of change has a schema, a permission rule, an
// apply step that records exactly what it changed, and (where possible) an undo.

const DAY = 86_400_000;
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const ACTION_SCHEMAS = {
  extend_target: z.object({ newTarget: isoDate }),
  add_team_spot: z.object({ newSize: z.number().int().min(2).max(10) }),
  start_with_current_team: z.object({}),
  reassign_step: z.object({ stepId: z.string(), toUserId: z.string() }),
  reschedule_overdue: z.object({ changes: z.array(z.object({ stepId: z.string(), due: isoDate })).min(1).max(10) }),
  nudge_team: z.object({ message: z.string().min(5).max(1500) }),
};
export type ActionKind = keyof typeof ACTION_SCHEMAS;
export const ACTION_KINDS = Object.keys(ACTION_SCHEMAS) as ActionKind[];

type Loaded = Prisma.ProjectGetPayload<{ include: { team: true; steps: true } }>;

/** Who may apply each kind: owners and admins steer scope; the team runs the plan. */
export function canApply(user: User, p: Loaded, kind: ActionKind): boolean {
  const onTeam = p.team.some((m) => m.userId === user.id);
  const steers = p.ownerId === user.id || user.isAdmin;
  switch (kind) {
    case "extend_target":
    case "add_team_spot":
      return steers && ["RECRUITING", "BUILDING"].includes(p.stage);
    case "start_with_current_team":
      return steers && p.stage === "RECRUITING" && p.team.length >= 1;
    case "reassign_step":
    case "reschedule_overdue":
      return (onTeam || steers) && p.stage === "BUILDING";
    case "nudge_team":
      return onTeam || steers;
  }
}

export type ApplyResult = { ok: true; summary: string; undo: unknown | null } | { ok: false; error: string };

export async function applyAction(user: User, projectId: string, kind: ActionKind, rawPayload: unknown): Promise<ApplyResult> {
  const parsed = ACTION_SCHEMAS[kind]?.safeParse(rawPayload);
  if (!parsed?.success) return { ok: false, error: "That change isn't valid any more." };
  const p = await db.project.findUnique({ where: { id: projectId }, include: { team: true, steps: true } });
  if (!p) return { ok: false, error: "Project not found." };
  if (!canApply(user, p, kind)) return { ok: false, error: "You don't have permission to make that change." };
  const who = firstName(user.name);
  const t = now();

  switch (kind) {
    case "extend_target": {
      const { newTarget } = parsed.data as z.infer<typeof ACTION_SCHEMAS.extend_target>;
      const target = parseZoned(newTarget);
      if (target.getTime() <= t.getTime()) return { ok: false, error: "The new date must be in the future." };
      // Re-space open steps proportionally into the new window, so the plan stays realistic.
      const oldSpan = Math.max(DAY, p.targetDate.getTime() - t.getTime());
      const newSpan = target.getTime() - t.getTime();
      const open = p.steps.filter((s) => !s.done);
      const undo = { target: p.targetDate.toISOString(), dues: open.map((s) => ({ id: s.id, due: s.dueDate.toISOString() })) };
      await db.$transaction(async (tx) => {
        await tx.project.update({ where: { id: p.id }, data: { targetDate: target } });
        for (const s of open) {
          const ratio = Math.max(0, (s.dueDate.getTime() - t.getTime()) / oldSpan);
          const due = new Date(Math.min(target.getTime(), t.getTime() + Math.max(DAY, ratio * newSpan)));
          await tx.planStep.update({ where: { id: s.id }, data: { dueDate: due } });
        }
        await logEvent(tx, p.id, "STEP_EDITED", user.id, `Target moved to ${shortDate(target)} with Spine`);
        await systemMessage(tx, p.id, `${who} moved the target to ${shortDate(target)} on Spine's recommendation and re-spaced ${open.length} open steps`);
        await touch(tx, p.id);
      });
      return { ok: true, summary: `Target moved to ${shortDate(target)}.`, undo };
    }

    case "add_team_spot": {
      const { newSize } = parsed.data as z.infer<typeof ACTION_SCHEMAS.add_team_spot>;
      if (newSize <= p.teamSize) return { ok: false, error: "The team is already that size." };
      await db.$transaction(async (tx) => {
        await tx.project.update({ where: { id: p.id }, data: { teamSize: newSize } });
        await systemMessage(tx, p.id, `${who} opened ${newSize - p.teamSize === 1 ? "a spot" : `${newSize - p.teamSize} spots`} on the team on Spine's recommendation`);
        await touch(tx, p.id);
      });
      return { ok: true, summary: `Team size is now ${newSize}. Anyone can join from the Team tab.`, undo: { size: p.teamSize } };
    }

    case "start_with_current_team": {
      await db.$transaction(async (tx) => {
        await tx.project.update({ where: { id: p.id }, data: { teamSize: p.team.length } });
        await systemMessage(tx, p.id, `${who} started building with the ${p.team.length} people already on the team, on Spine's recommendation`);
      });
      await startBuilding(p.id);
      return { ok: true, summary: "Building has started and the plan is being assigned.", undo: null };
    }

    case "reassign_step": {
      const { stepId, toUserId } = parsed.data as z.infer<typeof ACTION_SCHEMAS.reassign_step>;
      const step = p.steps.find((s) => s.id === stepId);
      const to = p.team.find((m) => m.userId === toUserId);
      if (!step || step.done || !to) return { ok: false, error: "That step or person isn't on the plan any more." };
      const toUser = await db.user.findUniqueOrThrow({ where: { id: toUserId } });
      await db.$transaction(async (tx) => {
        await tx.planStep.update({ where: { id: step.id }, data: { assigneeId: toUserId } });
        await logEvent(tx, p.id, "STEP_EDITED", user.id, step.title);
        await systemMessage(tx, p.id, `${who} moved ${step.title} to ${firstName(toUser.name)} to balance the work`);
        await touch(tx, p.id);
      });
      return { ok: true, summary: `${step.title} is now ${firstName(toUser.name)}'s.`, undo: { stepId: step.id, assigneeId: step.assigneeId } };
    }

    case "reschedule_overdue": {
      const { changes } = parsed.data as z.infer<typeof ACTION_SCHEMAS.reschedule_overdue>;
      const valid = changes.filter((c) => p.steps.some((s) => s.id === c.stepId && !s.done));
      if (!valid.length) return { ok: false, error: "Those steps are already done." };
      const undo = { dues: valid.map((c) => ({ id: c.stepId, due: p.steps.find((s) => s.id === c.stepId)!.dueDate.toISOString() })) };
      await db.$transaction(async (tx) => {
        for (const c of valid) await tx.planStep.update({ where: { id: c.stepId }, data: { dueDate: parseZoned(c.due) } });
        await systemMessage(tx, p.id, `${who} rescheduled ${valid.length} overdue ${valid.length === 1 ? "step" : "steps"} to realistic dates`);
        await touch(tx, p.id);
      });
      return { ok: true, summary: `Rescheduled ${valid.length} ${valid.length === 1 ? "step" : "steps"}.`, undo };
    }

    case "nudge_team": {
      const { message } = parsed.data as z.infer<typeof ACTION_SCHEMAS.nudge_team>;
      await db.$transaction(async (tx) => {
        await tx.projectMessage.create({ data: { projectId: p.id, authorId: user.id, body: message, sentAt: t } });
        await touch(tx, p.id);
      });
      return { ok: true, summary: "Posted to the team chat.", undo: null };
    }
  }
}

/** Reverses an applied change from its recorded undo data. */
export async function undoAction(user: User, projectId: string, kind: ActionKind, undo: unknown): Promise<{ ok: boolean; error?: string }> {
  const p = await db.project.findUnique({ where: { id: projectId }, include: { team: true, steps: true } });
  if (!p || !canApply(user, p, kind) || !undo) return { ok: false, error: "This can't be undone now." };
  const u = undo as Record<string, unknown>;
  await db.$transaction(async (tx) => {
    if (kind === "extend_target") {
      await tx.project.update({ where: { id: p.id }, data: { targetDate: new Date(String(u.target)) } });
      for (const d of u.dues as { id: string; due: string }[]) await tx.planStep.updateMany({ where: { id: d.id, done: false }, data: { dueDate: new Date(d.due) } });
    }
    if (kind === "add_team_spot") {
      await tx.project.update({ where: { id: p.id }, data: { teamSize: Math.max(p.team.length, Number(u.size)) } });
    }
    if (kind === "reassign_step") {
      await tx.planStep.updateMany({ where: { id: String(u.stepId), done: false }, data: { assigneeId: String(u.assigneeId) } });
    }
    if (kind === "reschedule_overdue") {
      for (const d of u.dues as { id: string; due: string }[]) await tx.planStep.updateMany({ where: { id: d.id, done: false }, data: { dueDate: new Date(d.due) } });
    }
    await systemMessage(tx, p.id, `${firstName(user.name)} undid a Spine change`);
    await touch(tx, p.id);
  });
  return { ok: true };
}
