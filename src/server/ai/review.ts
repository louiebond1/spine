import "server-only";
import { z } from "zod";
import { longDate } from "@/lib/format";
import { now } from "../clock";
import { db } from "../db";
import { askClaudeForJson, fixturesEnabled } from "./client";

// CLAUDE.md section 7, Ideas & Projects rule 4: four advisory scores from 1 to 10, higher is
// better, each with one plain-English line. Originality names the closest existing project.

const score = z.object({ score: z.number().int().min(1).max(10), reason: z.string().min(3).max(240) });
const reviewSchema = z.object({
  feasibility: score,
  businessValue: score,
  resourcingConfidence: score,
  originality: score.extend({ closestProjectId: z.string().nullable() }),
});
type Review = z.infer<typeof reviewSchema>;

const SYSTEM = `You review AI project ideas for a company's AI adoption programme. Score four things from 1 to 10, where higher is always better:
- feasibility: can this be built with the tools and skills described?
- businessValue: how much it helps the people who benefit
- resourcingConfidence: is the team size, hours and length realistic for the scope?
- originality: 10 means nothing similar exists; low means it overlaps an existing project
Each reason is one short plain-English sentence, under 20 words, no jargon, no em dashes.
For originality, compare against the existing projects listed and set closestProjectId to the id of the most similar one, or null if none is meaningfully similar. When there is overlap, name that project in the reason.
JSON shape: {"feasibility":{"score":n,"reason":""},"businessValue":{...},"resourcingConfidence":{...},"originality":{"score":n,"reason":"","closestProjectId":"id or null"}}`;

function fixture(title: string, others: { id: string; title: string }[]): Review {
  const related = others.find((o) => o.title === "Supplier Research Assistant");
  if (title === "Supplier Risk Checker" && related) {
    return {
      feasibility: { score: 8, reason: "Doable with the tools available and a clear build approach." },
      businessValue: { score: 7, reason: "Solves a real need and could improve supplier due diligence." },
      resourcingConfidence: { score: 7, reason: "Realistic for the team size and timeframe." },
      originality: {
        score: 4,
        reason: "Overlaps heavily with Supplier Research Assistant, which also gathers and summarises supplier information.",
        closestProjectId: related.id,
      },
    };
  }
  return {
    feasibility: { score: 8, reason: "Doable with the tools the team already uses." },
    businessValue: { score: 7, reason: "Saves time for the people who would use it." },
    resourcingConfidence: { score: 7, reason: "The team size and timeframe look realistic." },
    originality: { score: 8, reason: "No existing project covers this.", closestProjectId: null },
  };
}

/** Runs (or re-runs) the review and stores it. Throws if Claude can't be reached. */
export async function runAiReview(projectId: string) {
  const p = await db.project.findUniqueOrThrow({ where: { id: projectId }, include: { topic: true } });
  const others = await db.project.findMany({
    where: { id: { not: p.id }, stage: { not: "IDEA" } },
    select: { id: true, title: true, problem: true },
  });

  const review = fixturesEnabled()
    ? fixture(p.title, others)
    : await askClaudeForJson({
        system: SYSTEM,
        schema: reviewSchema,
        prompt: [
          `Idea: ${p.title}`,
          `Problem: ${p.problem}`,
          `Who benefits: ${p.whoBenefits}`,
          `Topic: ${p.topic.name}`,
          `Build path: ${p.buildPath === "APP" ? "App (needs infrastructure, hosting or admin access)" : "Cowork-native (built within approved workplace tools)"}`,
          `Team: ${p.teamSize} people, ${p.hoursPerWeek} hours a week each, ${p.lengthWeeks} weeks, difficulty ${p.difficulty.toLowerCase()}, target ${longDate(p.targetDate)}`,
          "",
          "Existing projects:",
          ...others.map((o) => `- id ${o.id}: ${o.title}. ${o.problem}`),
        ].join("\n"),
      });

  const relatedProjectId = others.some((o) => o.id === review.originality.closestProjectId) ? review.originality.closestProjectId : null;
  const scores = [review.feasibility.score, review.businessValue.score, review.resourcingConfidence.score, review.originality.score];
  const clean = (s: string) => s.replace(new RegExp(String.fromCharCode(0x2014), "g"), ",");
  const data = {
    feasibility: review.feasibility.score,
    feasibilityReason: clean(review.feasibility.reason),
    businessValue: review.businessValue.score,
    businessValueReason: clean(review.businessValue.reason),
    resourcingConfidence: review.resourcingConfidence.score,
    resourcingConfidenceReason: clean(review.resourcingConfidence.reason),
    originality: review.originality.score,
    originalityReason: clean(review.originality.reason),
    relatedProjectId,
    // Computed here, never trusted from the model.
    raisedConcerns: scores.some((s) => s <= 5),
    completedAt: now(),
  };

  await db.$transaction([
    db.aiReview.upsert({ where: { projectId }, create: { projectId, ...data }, update: data }),
    db.projectEvent.create({ data: { projectId, type: "AI_REVIEWED", actorId: null, at: now() } }),
  ]);
}
