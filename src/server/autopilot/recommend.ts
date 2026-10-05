import "server-only";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { firstName, plural, shortDate } from "@/lib/format";
import { askClaudeForJson, fixturesEnabled } from "../ai/client";
import { now } from "../clock";
import { db } from "../db";
import { getSettings } from "../settings";
import type { ActionKind } from "./engine";
import { loadAutopilotProject, signals, type AutopilotProject } from "./signals";

// Spine Autopilot, part 3: recommend. Candidates come from the measured signals with exact
// parameters; Claude only chooses which matter most and explains them in plain English.

const DAY = 86_400_000;
const isoDay = (d: Date) => d.toISOString().slice(0, 10);

type Candidate = { key: string; kind: ActionKind; headline: string; reason: string; payload: Record<string, unknown>; priority: number };

function candidates(p: AutopilotProject, s: ReturnType<typeof signals>): Candidate[] {
  const out: Candidate[] = [];
  const t = now().getTime();
  const name = (id: string) => firstName(p.team.find((m) => m.userId === id)?.user.name ?? p.steps.find((st) => st.assigneeId === id)?.assignee.name ?? "someone");
  const ordinal = (n: number) => ["", "1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th", "9th", "10th"][n] ?? `${n}th`;

  if (p.stage === "RECRUITING" && s.openSpots > 0 && p.team.length >= 2 && s.recruitingQuietDays >= 3) {
    out.push({
      key: "start",
      kind: "start_with_current_team",
      headline: `Start building with the ${p.team.length} people you have`,
      reason: `No one has joined in ${plural(s.recruitingQuietDays, "day")}. Spine will assign the plan across ${p.team.map((m) => firstName(m.user.name)).join(", ")} today, and you can still add people later.`,
      payload: {},
      priority: 90,
    });
  }

  const f = s.forecast;
  if (f && f.daysLate >= 3) {
    const newTarget = new Date(Math.ceil(f.finishDate.getTime() / DAY) * DAY + 2 * DAY);
    out.push({
      key: "extend",
      kind: "extend_target",
      headline: `Move the target to ${shortDate(newTarget)}`,
      reason: `At the current pace (${f.pacePerWeek} steps a week) the last ${plural(p.steps.filter((x) => !x.done).length, "step")} land around ${shortDate(f.finishDate)}, ${plural(f.daysLate, "day")} after the target. Spine will re-space the open steps to fit.`,
      payload: { newTarget: isoDay(newTarget) },
      priority: 70 + Math.min(20, f.daysLate),
    });
    if (f.daysLate >= 7 && p.teamSize < 10) {
      out.push({
        key: "spot",
        kind: "add_team_spot",
        headline: `Add a ${ordinal(p.teamSize + 1)} person to the team`,
        reason: `It's forecast ${plural(f.daysLate, "day")} late with ${p.team.length} people. One more person at ${p.hoursPerWeek} hours a week would cover the gap. Spine opens a spot that anyone can join.`,
        payload: { newSize: p.teamSize + 1 },
        priority: 65 + Math.min(20, f.daysLate),
      });
    }
  }

  if (s.overloaded) {
    const step = p.steps
      .filter((x) => !x.done && x.assigneeId === s.overloaded!.fromId)
      .sort((a, b) => b.dueDate.getTime() - a.dueDate.getTime())[0];
    if (step) {
      out.push({
        key: "rebalance",
        kind: "reassign_step",
        headline: `Move "${step.title}" from ${name(s.overloaded.fromId)} to ${name(s.overloaded.toId)}`,
        reason: `${name(s.overloaded.fromId)} owns ${s.overloaded.count} of the ${s.overloaded.of} open steps while ${name(s.overloaded.toId)} has the fewest. Balancing it removes the bottleneck.`,
        payload: { stepId: step.id, toUserId: s.overloaded.toId },
        priority: 60,
      });
    }
  }

  if (s.overdue.length) {
    const target = p.targetDate.getTime();
    const changes = s.overdue.map((x, i) => ({ stepId: x.id, due: isoDay(new Date(Math.min(target, t + (3 + i * 3) * DAY))) }));
    out.push({
      key: "reschedule",
      kind: "reschedule_overdue",
      headline: `Reschedule ${plural(s.overdue.length, "overdue step")}`,
      reason: `${s.overdue.map((x) => `"${x.title}" (${name(x.assigneeId)}, due ${shortDate(x.dueDate)})`).join(" and ")} ${s.overdue.length === 1 ? "is" : "are"} past due. Spine will give ${s.overdue.length === 1 ? "it" : "them"} realistic new dates a few days apart.`,
      payload: { changes },
      priority: 55,
    });
  }

  if (s.stalled) {
    const owners = [...new Set(p.steps.filter((x) => !x.done).slice(0, 2).map((x) => name(x.assigneeId)))];
    out.push({
      key: "nudge",
      kind: "nudge_team",
      headline: `Nudge the team, it's been quiet for ${plural(s.quietDays, "day")}`,
      reason: "A short, friendly check-in usually gets a quiet build moving again.",
      payload: {
        message: `Hi ${owners.join(" and ")}, quick check-in on ${p.title}. Is anything blocking the next step? If something's in the way, say so here and we'll sort it together.`,
      },
      priority: 50 + Math.min(20, s.quietDays),
    });
  }
  return out.sort((a, b) => b.priority - a.priority);
}

const pickSchema = z.object({
  picks: z
    .array(z.object({ key: z.string(), headline: z.string().min(5).max(90), reason: z.string().min(10).max(300), message: z.string().max(600).optional() }))
    .max(3),
});

const SYSTEM = `You are Spine, an AI project manager. You get a project's facts and a list of candidate fixes, each already computed from real data. Choose up to 3 that would most help this project finish well, most important first. Drop any that conflict with a better one or wouldn't help.
For each pick, rewrite the headline as a short action (under 12 words) and the reason as one or two plain sentences that cite the numbers. For a "nudge" pick, you may also write a warmer, specific "message" to the team (2 to 3 sentences, one clear question, no guilt).
Never change what the fix does. No em dashes. JSON shape: {"picks":[{"key":"","headline":"","reason":"","message":""}]}`;

/** Recomputes and stores a project's open recommendations. */
export async function refreshRecommendations(projectId: string) {
  const p = await loadAutopilotProject(projectId);
  if (!p) return;
  const settings = await getSettings();
  const all = candidates(p, signals(p, settings.stalledBuildDays));
  let chosen = all.slice(0, 3);

  if (all.length && !fixturesEnabled() && process.env.ANTHROPIC_API_KEY) {
    try {
      const s = signals(p, settings.stalledBuildDays);
      const result = await askClaudeForJson({
        system: SYSTEM,
        schema: pickSchema,
        maxTokens: 1200,
        prompt: [
          `Project: ${p.title} (${p.stage.toLowerCase()}), owner ${p.owner.name}, target ${shortDate(p.targetDate)}.`,
          `Problem: ${p.problem}`,
          `Team (${p.team.length} of ${p.teamSize}): ${p.team.map((m) => m.user.name).join(", ") || "none yet"}.`,
          `Plan: ${p.steps.filter((x) => x.done).length} of ${p.steps.length} steps done. Last activity ${s.quietDays} days ago.`,
          s.forecast ? `Forecast: ${s.forecast.pacePerWeek} steps a week, finishing ${shortDate(s.forecast.finishDate)} (${s.forecast.daysLate} days vs target).` : "",
          "",
          "Candidate fixes:",
          ...all.map((c) => `- key ${c.key} (${c.kind}): ${c.headline}. ${c.reason}`),
        ].join("\n"),
      });
      const byKey = new Map(all.map((c) => [c.key, c]));
      const picked = result.picks
        .filter((x) => byKey.has(x.key))
        .map((x) => {
          const c = byKey.get(x.key)!;
          const clean = (v: string) => v.replace(new RegExp(String.fromCharCode(0x2014), "g"), ",");
          return {
            ...c,
            headline: clean(x.headline),
            reason: clean(x.reason),
            payload: c.kind === "nudge_team" && x.message ? { message: clean(x.message) } : c.payload,
          };
        });
      if (picked.length) chosen = picked;
    } catch {
      // Keep the computed recommendations; Claude only improves the wording.
    }
  }

  await db.$transaction([
    db.recommendation.deleteMany({ where: { projectId, status: "OPEN" } }),
    db.recommendation.createMany({
      data: chosen.map((c) => ({ projectId, kind: c.kind, headline: c.headline, reason: c.reason, payload: c.payload as Prisma.InputJsonValue })),
    }),
    db.project.update({ where: { id: projectId }, data: { recommendationsAt: now() } }),
  ]);
}

/** Recommendations are stale when the project changed since they were made, or after 12 hours. */
export function recommendationsStale(p: { recommendationsAt: Date | null; lastActivityAt: Date; stage: string }) {
  if (!["RECRUITING", "BUILDING"].includes(p.stage)) return false;
  if (!p.recommendationsAt) return true;
  return p.recommendationsAt < p.lastActivityAt || now().getTime() - p.recommendationsAt.getTime() > 12 * 3_600_000;
}
