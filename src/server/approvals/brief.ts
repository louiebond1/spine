"use server";

import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { askClaudeForJson, fixturesEnabled, lenient as L } from "../ai/client";
import { db } from "../db";
import { assert, can } from "../permissions";
import { getCurrentUser } from "../session";
import { totalHours } from "./rules";

// Spine's approval brief: a short memo for whoever approves, written from the idea itself,
// what's already in flight and the cost in hours. It never contains or hints at the owner's AI
// scores (CLAUDE.md section 5); the only AI review signal approvers ever get is the neutral flag.

const briefSchema = z.object({
  summary: L.text(400),
  strengths: z.array(L.text(200)).default([]).transform((a) => a.slice(0, 3)),
  watchOuts: z.array(L.text(200)).default([]).transform((a) => a.slice(0, 3)),
  questions: z.array(L.text(200)).default([]).transform((a) => a.slice(0, 3)),
});
export type ApprovalBrief = z.infer<typeof briefSchema>;

export async function getApprovalBrief(projectId: string): Promise<{ ok: true; brief: ApprovalBrief } | { ok: false; error: string }> {
  const user = await getCurrentUser();
  const p = await db.project.findUnique({ where: { id: projectId }, include: { topic: true, owner: true, team: { include: { user: true } } } });
  assert(!!p && can.approve(user, p), "Only an approver can see this.");
  const cached = briefSchema.safeParse(p.approvalBrief);
  if (p.approvalBrief && cached.success) return { ok: true, brief: cached.data };

  const others = await db.project.findMany({
    where: { id: { not: p.id }, stage: { not: "IDEA" } },
    select: { title: true, problem: true, stage: true, topic: { select: { name: true } } },
    take: 40,
    orderBy: { lastActivityAt: "desc" },
  });
  const hours = totalHours(p);

  let brief: ApprovalBrief;
  try {
    brief = fixturesEnabled()
      ? {
          summary: `${p.title} asks for about ${hours} hours across ${p.teamSize} ${p.teamSize === 1 ? "person" : "people"} over ${p.lengthWeeks} weeks to help ${p.whoBenefits.toLowerCase()}.`,
          strengths: ["A clear, specific problem with a named audience.", "Small enough to finish before the target date."],
          watchOuts: others.some((o) => o.topic.name === p.topic.name) ? [`Overlaps in topic with ${others.find((o) => o.topic.name === p.topic.name)!.title}.`] : ["No similar project in flight."],
          questions: ["What data does it touch, and is any of it sensitive?", "How will you know it worked a month after Live?"],
        }
      : await askClaudeForJson({
          schema: briefSchema,
          maxTokens: 1200,
          system: `You write a short, neutral approval brief for a leader deciding whether to approve an internal AI project. Plain English, concrete, no hype, no em dashes.
summary: 1 to 2 sentences on what's being asked for and the cost in people and hours.
strengths: up to 3 reasons it's worth doing, grounded in the details.
watchOuts: up to 3 risks to check, including overlap with projects already in flight (name them) and anything about data, security or scope.
questions: up to 3 sharp questions to ask the owner before approving.
Do not give a score, rating or verdict, and do not recommend approving or rejecting.`,
          prompt: [
            `Idea: ${p.title} (${p.topic.name}, ${p.buildPath === "APP" ? "App: needs infrastructure" : "Cowork-native: built in workplace tools"}, ${p.difficulty.toLowerCase()})`,
            `Owner: ${p.owner.name}. Problem: ${p.problem}. Who benefits: ${p.whoBenefits}.`,
            `Ask: ${p.teamSize} people, ${p.hoursPerWeek} hrs a week each, ${p.lengthWeeks} weeks, about ${hours} hours in total. Target ${p.targetDate.toISOString().slice(0, 10)}.`,
            p.successMetric ? `Success measure: ${p.successMetric}. First version: ${p.mvpScope ?? ""}.` : "",
            p.buildCompletedAt ? "The build is already finished; this is the final sign-off before publishing." : "",
            "Projects already in flight:",
            ...others.map((o) => `- ${o.title} (${o.topic.name}, ${o.stage.toLowerCase()}): ${o.problem.slice(0, 160)}`),
          ].join("\n"),
        });
  } catch (error) {
    console.error("[approvals] brief failed", error);
    return { ok: false, error: "Spine couldn't write the brief just now." };
  }
  await db.project.update({ where: { id: p.id }, data: { approvalBrief: brief as unknown as Prisma.InputJsonValue } });
  return { ok: true, brief };
}
