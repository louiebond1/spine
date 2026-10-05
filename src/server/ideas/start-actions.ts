"use server";

import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";
import { parseZoned } from "@/lib/tz";
import { briefSchema, coachTurn, kickoffFromSentence, type CoachTurn, type IdeaBrief } from "../ai/coach";
import { now } from "../clock";
import { db } from "../db";
import { getCurrentUser } from "../session";
import * as lifecycle from "../projects/lifecycle";

export async function previewKickoff(sentence: string): Promise<{ ok: true; brief: IdeaBrief } | { ok: false; error: string }> {
  await getCurrentUser();
  const text = sentence.trim().slice(0, 1000);
  if (text.length < 12) return { ok: false, error: "Tell Spine a little more: what you want to build, and for whom." };
  try {
    return { ok: true, brief: await kickoffFromSentence(text) };
  } catch (error) {
    console.error("[start] kickoff failed", error);
    return { ok: false, error: "Spine couldn't read that just now. Try again." };
  }
}

export async function nextCoachTurn(transcript: { role: "spine" | "user"; text: string }[]): Promise<{ ok: true; turn: CoachTurn } | { ok: false; error: string }> {
  await getCurrentUser();
  const clean = transcript.slice(-20).map((t) => ({ role: t.role, text: String(t.text).slice(0, 1500) }));
  try {
    return { ok: true, turn: await coachTurn(clean) };
  } catch (error) {
    console.error("[start] coach turn failed", error);
    return { ok: false, error: "Spine lost its train of thought. Try sending that again." };
  }
}

/** One confirm: creates the idea with its brief and invites the people named. */
export async function createFromBrief(raw: unknown): Promise<{ ok: true; id: string; invited: string[] } | { ok: false; error: string }> {
  const user = await getCurrentUser();
  const parsed = briefSchema.safeParse(raw);
  if (!parsed.success) console.error("[start] invalid brief", parsed.error.issues);
  if (!parsed.success) return { ok: false, error: "Something in the brief wasn't valid. Try again." };
  const b = parsed.data;
  let target = parseZoned(b.targetDate);
  if (target.getTime() <= now().getTime()) target = new Date(now().getTime() + (b.lengthWeeks + 1) * 7 * 86_400_000);

  const [topics, users] = await Promise.all([db.topic.findMany({ where: { archivedAt: null } }), db.user.findMany()]);
  const topic = topics.find((t) => t.name.toLowerCase() === b.topic.toLowerCase()) ?? topics.find((t) => t.name === "Productivity") ?? topics[0];
  if (!topic) return { ok: false, error: "There are no topics set up yet." };

  // Match named people to real colleagues (full name, or an unambiguous first name).
  const invitees = [
    ...new Map(
      b.people
        .map((name) => {
          const n = name.trim().toLowerCase();
          const exact = users.find((u) => u.name.toLowerCase() === n);
          const byFirst = users.filter((u) => u.name.split(" ")[0]!.toLowerCase() === n.split(" ")[0]);
          return exact ?? (byFirst.length === 1 ? byFirst[0] : undefined);
        })
        .filter((u): u is NonNullable<typeof u> => !!u && u.id !== user.id)
        .map((u) => [u.id, u]),
    ).values(),
  ];

  const p = await db.project.create({
    data: {
      title: b.title,
      problem: b.problem,
      whoBenefits: b.whoBenefits,
      topicId: topic.id,
      buildPath: b.buildPath,
      teamSize: Math.max(b.teamSize, invitees.length + 1),
      hoursPerWeek: b.hoursPerWeek,
      lengthWeeks: b.lengthWeeks,
      difficulty: b.difficulty,
      targetDate: target,
      ownerId: user.id,
      stage: "IDEA",
      lastActivityAt: now(),
      useCases: b.useCases as unknown as Prisma.InputJsonValue,
      successMetric: b.successMetric || null,
      mvpScope: b.mvpScope || null,
      laterScope: b.laterScope || null,
      hoursSavedEstimate: b.hoursSavedEstimate || null,
      events: { create: { type: "CREATED", actorId: user.id, at: now(), detail: "Started with Spine" } },
      invites: { create: invitees.map((u) => ({ userId: u.id, invitedById: user.id })) },
    },
  });
  revalidatePath("/", "layout");
  return { ok: true, id: p.id, invited: invitees.map((u) => u.name) };
}

export async function respondToInvite(projectId: string, accept: boolean): Promise<{ ok: boolean; message: string }> {
  const user = await getCurrentUser();
  const invite = await db.projectInvite.findUnique({ where: { projectId_userId: { projectId, userId: user.id } }, include: { project: { include: { team: true } } } });
  if (!invite || invite.status !== "PENDING") return { ok: false, message: "This invite has already been answered." };
  await db.projectInvite.update({ where: { id: invite.id }, data: { status: accept ? "ACCEPTED" : "DECLINED" } });
  let message = accept ? "You're in. You'll join the team as soon as it starts recruiting." : "Declined.";
  const p = invite.project;
  if (accept && (p.stage === "RECRUITING" || p.stage === "BUILDING") && p.team.length < p.teamSize) {
    await lifecycle.join(projectId, user.id);
    message = "You've joined the team.";
  }
  revalidatePath("/", "layout");
  return { ok: true, message };
}
