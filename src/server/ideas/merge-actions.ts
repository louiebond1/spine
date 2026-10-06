"use server";

import { revalidatePath } from "next/cache";
import { now } from "../clock";
import { db } from "../db";
import { notify } from "../notify/notify";
import { STAGE_LABEL } from "../projects/lifecycle";
import * as lifecycle from "../projects/lifecycle";
import { getCurrentUser } from "../session";

// "Join this instead": while someone proposes an idea, Spine looks for projects already in
// flight that solve the same problem, and offers to join one rather than start a duplicate.
// Their draft's problem statement is posted into that project's chat so nothing is lost.

const STOP = new Set("a an and the to for of in on with our we my is are be it this that from by at as can how what who will so into more less make tool app ai claude using use".split(" "));
const tokens = (s: string) => new Set(s.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2 && !STOP.has(w)));

export type InFlight = { id: string; title: string; stage: string; detail: string; canJoin: boolean };

export async function findInFlight(title: string, problem: string, excludeId?: string | null): Promise<InFlight[]> {
  const user = await getCurrentUser();
  const want = tokens(`${title} ${title} ${problem}`.slice(0, 2000));
  if (want.size < 2) return [];
  const projects = await db.project.findMany({
    where: { stage: { notIn: ["IDEA"] }, id: excludeId ? { not: excludeId } : undefined },
    select: { id: true, title: true, problem: true, stage: true, teamSize: true, team: { select: { userId: true } } },
  });
  return projects
    .map((p) => {
      const have = tokens(`${p.title} ${p.title} ${p.problem}`);
      const overlap = [...want].filter((w) => have.has(w)).length;
      return { p, score: overlap / Math.min(want.size, have.size || 1) };
    })
    .filter((x) => x.score >= 0.3)
    .sort((a, b) => b.score - a.score)
    .slice(0, 2)
    .map(({ p }) => {
      const spots = p.teamSize - p.team.length;
      const onTeam = p.team.some((m) => m.userId === user.id);
      const open = (p.stage === "RECRUITING" || p.stage === "BUILDING") && spots > 0 && !onTeam;
      const detail = onTeam
        ? "You're already on this team"
        : p.stage === "LIVE"
          ? "Already Live, ready to use"
          : open
            ? `${STAGE_LABEL[p.stage]}, needs ${spots} more ${spots === 1 ? "person" : "people"}`
            : STAGE_LABEL[p.stage];
      return { id: p.id, title: p.title, stage: STAGE_LABEL[p.stage], detail, canJoin: open };
    });
}

export async function joinInstead(targetId: string, idea: { title: string; problem: string; draftId?: string | null }): Promise<{ ok: true; href: string } | { ok: false; error: string }> {
  const user = await getCurrentUser();
  const target = await db.project.findUnique({ where: { id: targetId }, include: { team: true } });
  if (!target || !(target.stage === "RECRUITING" || target.stage === "BUILDING") || target.team.length >= target.teamSize) return { ok: false, error: "That project isn't taking new people right now." };
  try {
    await lifecycle.join(target.id, user.id);
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Couldn't join just now." };
  }
  const title = idea.title.trim().slice(0, 120) || "a similar idea";
  const problem = idea.problem.trim().slice(0, 1500);
  await db.$transaction(async (tx) => {
    if (problem) await tx.projectMessage.create({ data: { projectId: target.id, authorId: user.id, body: `I was about to propose "${title}": ${problem} Joining here instead.`, sentAt: now() } });
    await lifecycle.logEvent(tx, target.id, "IDEA_MERGED", user.id, `"${title}"`);
    await lifecycle.touch(tx, target.id);
    if (idea.draftId) {
      const draft = await tx.project.findUnique({ where: { id: idea.draftId } });
      if (draft && draft.ownerId === user.id && draft.stage === "IDEA") await tx.project.delete({ where: { id: draft.id } });
    }
  });
  await notify([target.ownerId], { kind: "invite", title: `${user.name} joined ${target.title}`, body: `They were about to propose "${title}" and joined your project instead.`, href: `/ideas/${target.id}?tab=chat` }, user.id);
  revalidatePath("/", "layout");
  return { ok: true, href: `/ideas/${target.id}` };
}
