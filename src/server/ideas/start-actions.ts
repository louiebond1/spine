"use server";

import { revalidatePath } from "next/cache";
import { kickoffFromSentence, type IdeaBrief } from "../ai/coach";
import { AI_ERROR_TEXT, classify } from "../ai/client";
import { requireCtx } from "../ctx";
import * as lifecycle from "../projects/lifecycle";

export type KickoffDraft = { brief: IdeaBrief; topicId: string; invitees: { id: string; name: string }[] };

/** One sentence in, a drafted proposal out: the form is filled in for the person to edit. */
export async function previewKickoff(sentence: string): Promise<{ ok: true; draft: KickoffDraft } | { ok: false; error: string }> {
  const ctx = await requireCtx();
  const text = sentence.trim().slice(0, 1000);
  if (text.length < 12) return { ok: false, error: "Tell Spine a little more: what you want to build, and for whom." };
  try {
    const brief = await kickoffFromSentence(ctx, text);
    const [topics, users] = await Promise.all([ctx.db.topic.findMany({ where: { archivedAt: null } }), ctx.db.user.findMany({ where: { status: "ACTIVE" } })]);
    const topic = topics.find((t) => t.name.toLowerCase() === brief.topic.toLowerCase());
    const invitees = [
      ...new Map(
        brief.people
          .map((name) => {
            const n = name.trim().toLowerCase();
            const exact = users.find((u) => u.name.toLowerCase() === n);
            const byFirst = users.filter((u) => u.name.split(" ")[0]!.toLowerCase() === n.split(" ")[0]);
            return exact ?? (byFirst.length === 1 ? byFirst[0] : undefined);
          })
          .filter((u): u is NonNullable<typeof u> => !!u && u.id !== ctx.user.id)
          .map((u) => [u.id, { id: u.id, name: u.name }]),
      ).values(),
    ];
    return { ok: true, draft: { brief, topicId: topic?.id ?? "", invitees } };
  } catch (error) {
    return { ok: false, error: AI_ERROR_TEXT[classify(error)] };
  }
}

export async function respondToInvite(projectId: string, accept: boolean): Promise<{ ok: boolean; message: string }> {
  const ctx = await requireCtx();
  const { db, user } = ctx;
  const own = await db.project.findUnique({ where: { id: projectId }, select: { id: true } });
  if (!own) return { ok: false, message: "That initiative doesn't exist." };
  const invite = await db.projectInvite.findUnique({ where: { projectId_userId: { projectId, userId: user.id } }, include: { project: { include: { team: true } } } });
  if (!invite || invite.status !== "PENDING") return { ok: false, message: "This invite has already been answered." };
  await db.projectInvite.update({ where: { id: invite.id }, data: { status: accept ? "ACCEPTED" : "DECLINED" } });
  let message = accept ? "You're in. You'll join the team as soon as it's approved." : "Declined.";
  const p = invite.project;
  if (accept && (p.stage === "RECRUITING" || p.stage === "BUILDING") && p.team.length < p.teamSize) {
    await lifecycle.join(ctx, projectId, user.id);
    message = "You've joined the team.";
  }
  revalidatePath("/", "layout");
  return { ok: true, message };
}
