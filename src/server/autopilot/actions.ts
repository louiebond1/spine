"use server";

import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";
import { now } from "../clock";
import { db } from "../db";
import { getCurrentUser } from "../session";
import { ACTION_KINDS, applyAction, undoAction, type ActionKind } from "./engine";
import { recommendationsStale, refreshRecommendations } from "./recommend";

const UNDO_WINDOW = 24 * 3_600_000;

async function visibleProject(projectId: string) {
  const user = await getCurrentUser();
  const p = await db.project.findUnique({ where: { id: projectId } });
  if (!p || (p.stage === "IDEA" && p.ownerId !== user.id)) return null;
  return { user, p };
}

/** Called by the project page; only recomputes when the project changed. */
export async function refreshProjectRecommendations(projectId: string): Promise<{ refreshed: boolean }> {
  const v = await visibleProject(projectId);
  if (!v || !recommendationsStale(v.p)) return { refreshed: false };
  try {
    await refreshRecommendations(projectId);
    return { refreshed: true };
  } catch {
    return { refreshed: false };
  }
}

export async function applyRecommendation(id: string): Promise<{ ok: boolean; message: string }> {
  const user = await getCurrentUser();
  const rec = await db.recommendation.findUnique({ where: { id } });
  if (!rec || rec.status !== "OPEN") return { ok: false, message: "That recommendation has already been handled." };
  const result = await applyAction(user, rec.projectId, rec.kind as ActionKind, rec.payload);
  if (!result.ok) return { ok: false, message: result.error };
  await db.recommendation.update({
    where: { id },
    data: { status: "APPLIED", appliedById: user.id, appliedAt: now(), undo: (result.undo ?? undefined) as Prisma.InputJsonValue | undefined },
  });
  revalidatePath("/", "layout");
  return { ok: true, message: result.summary };
}

/** Ask Spine proposals: applied directly, recorded so they can be undone like any other. */
export async function applyChange(projectId: string, kind: string, payload: unknown, headline: string): Promise<{ ok: boolean; message: string; recommendationId?: string }> {
  const user = await getCurrentUser();
  if (!ACTION_KINDS.includes(kind as ActionKind)) return { ok: false, message: "Unknown change." };
  const result = await applyAction(user, projectId, kind as ActionKind, payload);
  if (!result.ok) return { ok: false, message: result.error };
  const rec = await db.recommendation.create({
    data: {
      projectId,
      kind,
      headline: headline.slice(0, 120),
      reason: "Applied from Ask Spine",
      payload: payload as Prisma.InputJsonValue,
      status: "APPLIED",
      appliedById: user.id,
      appliedAt: now(),
      undo: (result.undo ?? undefined) as Prisma.InputJsonValue | undefined,
    },
  });
  revalidatePath("/", "layout");
  return { ok: true, message: result.summary, recommendationId: rec.id };
}

export async function dismissRecommendation(id: string) {
  const user = await getCurrentUser();
  const rec = await db.recommendation.findUnique({ where: { id }, include: { project: { include: { team: true } } } });
  if (!rec || rec.status !== "OPEN") return;
  const allowed = user.isAdmin || rec.project.ownerId === user.id || rec.project.team.some((m) => m.userId === user.id);
  if (!allowed) return;
  await db.recommendation.update({ where: { id }, data: { status: "DISMISSED" } });
  revalidatePath(`/ideas/${rec.projectId}`);
}

export async function undoRecommendation(id: string): Promise<{ ok: boolean; message: string }> {
  const user = await getCurrentUser();
  const rec = await db.recommendation.findUnique({ where: { id } });
  if (!rec || rec.status !== "APPLIED" || !rec.undo || !rec.appliedAt || now().getTime() - rec.appliedAt.getTime() > UNDO_WINDOW) {
    return { ok: false, message: "This can't be undone any more." };
  }
  const r = await undoAction(user, rec.projectId, rec.kind as ActionKind, rec.undo);
  if (!r.ok) return { ok: false, message: r.error ?? "This can't be undone." };
  await db.recommendation.update({ where: { id }, data: { status: "UNDONE" } });
  revalidatePath("/", "layout");
  return { ok: true, message: "Undone." };
}

/** Programme's portfolio brief: refresh stale recommendations across active projects. */
export async function refreshPortfolio(): Promise<{ refreshed: number }> {
  const user = await getCurrentUser();
  if (!user.isAdmin) return { refreshed: 0 };
  const projects = await db.project.findMany({ where: { stage: { in: ["RECRUITING", "BUILDING"] } }, select: { id: true, stage: true, lastActivityAt: true, recommendationsAt: true } });
  const stale = projects.filter(recommendationsStale).slice(0, 6);
  for (const p of stale) {
    try {
      await refreshRecommendations(p.id);
    } catch {
      // keep going
    }
  }
  return { refreshed: stale.length };
}
