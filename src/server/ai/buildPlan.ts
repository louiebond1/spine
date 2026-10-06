import "server-only";
import { z } from "zod";
import { longDate } from "@/lib/format";
import { now } from "../clock";
import { db } from "../db";
import { askClaudeForJson, fixturesEnabled } from "./client";

// CLAUDE.md section 7, Ideas & Projects rule 8: 6 to 10 concrete steps from the brief, each
// assigned to a team member with a due date spread before the target date, plus a short
// present-tense phrase used in the next action sentence.

const planSchema = z.object({
  steps: z
    .array(
      z.object({
        title: z.string().min(3).max(120),
        activePhrase: z.string().min(3).max(60),
        assigneeId: z.string(),
      }),
    )
    .min(6)
    .max(10),
});
type Plan = z.infer<typeof planSchema>;

const SYSTEM = `You write build plans for small internal AI projects. Write 6 to 10 concrete steps in order, from understanding the problem to preparing for publishing.
Each step has:
- title: a short imperative task, under 8 words, sentence case (for example "Test against real supplier cases")
- activePhrase: the same task as a short present-tense phrase that completes the sentence "Jamie is ..." (for example "testing supplier cases"), lower case, under 6 words
- assigneeId: one of the team member ids given, sharing the work fairly
No em dashes. JSON shape: {"steps":[{"title":"","activePhrase":"","assigneeId":""}]}`;

function fixture(team: { id: string }[]): Plan {
  const steps: [string, string][] = [
    ["Map the current process", "mapping the current process"],
    ["Collect real examples", "collecting real examples"],
    ["Draft the first prompts", "drafting the first prompts"],
    ["Build a first working version", "building the first version"],
    ["Test with real cases", "testing with real cases"],
    ["Fix issues from testing", "fixing issues from testing"],
    ["Write a short how to guide", "writing the how to guide"],
    ["Prepare for publishing", "preparing for publishing"],
  ];
  return { steps: steps.map(([title, activePhrase], i) => ({ title, activePhrase, assigneeId: team[i % team.length]!.id })) };
}

export async function generateBuildPlan(projectId: string) {
  const p = await db.project.findUniqueOrThrow({
    where: { id: projectId },
    include: { topic: true, team: { include: { user: true }, orderBy: { joinedAt: "asc" } } },
  });
  const team = p.team.map((m) => ({ id: m.userId, name: m.user.name }));
  if (team.length === 0) return;

  try {
    const drafts = await db.draftStep.findMany({ where: { projectId }, orderBy: { order: "asc" } });
    const plan: Plan = drafts.length
      ? { steps: drafts.map((d, i) => ({ title: d.title, activePhrase: d.activePhrase, assigneeId: team[i % team.length]!.id })) }
      : fixturesEnabled()
      ? fixture(team)
      : await askClaudeForJson({
          system: SYSTEM,
          schema: planSchema,
          prompt: [
            `Project: ${p.title}`,
            `Problem: ${p.problem}`,
            `Who benefits: ${p.whoBenefits}`,
            `Topic: ${p.topic.name}`,
            `Build path: ${p.buildPath === "APP" ? "App" : "Cowork-native (built within approved workplace tools)"}`,
            `Effort: ${p.hoursPerWeek} hours a week each for ${p.lengthWeeks} weeks, difficulty ${p.difficulty.toLowerCase()}`,
            `Target date: ${longDate(p.targetDate)}`,
            "Team:",
            ...team.map((m) => `- id ${m.id}: ${m.name}`),
          ].join("\n"),
        });

    // Due dates are spread evenly between today and the target date on the server.
    const start = now().getTime();
    const end = Math.max(p.targetDate.getTime(), start + plan.steps.length * 86_400_000);
    const ids = new Set(team.map((m) => m.id));
    const clean = (s: string) => s.replace(new RegExp(String.fromCharCode(0x2014), "g"), ",");

    await db.$transaction([
      db.planStep.deleteMany({ where: { projectId, generatedFromBrief: true, done: false } }),
      db.planStep.createMany({
        data: plan.steps.map((s, i) => ({
          projectId,
          title: clean(s.title),
          activePhrase: clean(s.activePhrase).replace(/\.$/, "").toLowerCase(),
          assigneeId: ids.has(s.assigneeId) ? s.assigneeId : team[i % team.length]!.id,
          dueDate: new Date(start + ((i + 1) * (end - start)) / plan.steps.length),
          order: i,
          generatedFromBrief: true,
        })),
      }),
      db.project.update({ where: { id: projectId }, data: { planStatus: "READY", lastActivityAt: now() } }),
      db.projectEvent.create({ data: { projectId, type: "PLAN_GENERATED", actorId: null, at: now() } }),
    ]);
    const { planReady } = await import("../notify/events");
    await planReady(projectId).catch((e) => console.error("[notify] plan ready", e));
  } catch {
    await db.project.update({ where: { id: projectId }, data: { planStatus: "FAILED" } });
  }
}

/** A present-tense phrase for a step added by hand (PLAN.md Q24). */
export async function phraseForStep(title: string): Promise<string> {
  const fallback = `working on ${title.charAt(0).toLowerCase()}${title.slice(1)}`.replace(/\.$/, "");
  if (fixturesEnabled()) return fallback;
  try {
    const result = await askClaudeForJson({
      system:
        'Turn a task title into a short lower-case present-tense phrase that completes "Jamie is ...", under 6 words. JSON shape: {"activePhrase":""}',
      prompt: title,
      schema: z.object({ activePhrase: z.string().min(3).max(60) }),
      maxTokens: 100,
    });
    return result.activePhrase.replace(/\.$/, "").toLowerCase();
  } catch {
    return fallback;
  }
}

// ---------------------------------------------------------------------------
// Draft plan at proposal time: steps without people or dates, so the owner can see
// how the idea would be built straight away. Assigned when the team is complete.
// ---------------------------------------------------------------------------

const draftSchema = z.object({
  steps: z
    .array(z.object({ title: z.string().min(3).max(120), activePhrase: z.string().min(3).max(60) }))
    .min(6)
    .max(10),
});

const DRAFT_SYSTEM = `You write build plans for small internal AI projects. Write 6 to 10 concrete steps in order, from understanding the problem to preparing for publishing, specific to this idea (not generic).
Each step has:
- title: a short imperative task, under 8 words, sentence case
- activePhrase: the same task as a short present-tense phrase that completes "Jamie is ...", lower case, under 6 words
No em dashes. JSON shape: {"steps":[{"title":"","activePhrase":""}]}`;

export async function generateDraftPlan(projectId: string) {
  const p = await db.project.findUniqueOrThrow({ where: { id: projectId }, include: { topic: true } });
  const plan = fixturesEnabled()
    ? { steps: fixture([{ id: "x" }]).steps.map(({ title, activePhrase }) => ({ title, activePhrase })) }
    : await askClaudeForJson({
        system: DRAFT_SYSTEM,
        schema: draftSchema,
        prompt: [
          `Project: ${p.title}`,
          `Problem: ${p.problem}`,
          `Who benefits: ${p.whoBenefits}`,
          `Topic: ${p.topic.name}`,
          `Build path: ${p.buildPath === "APP" ? "App (needs infrastructure, hosting or admin access)" : "Cowork-native (built within approved workplace tools)"}`,
          `Team: ${p.teamSize} people, ${p.hoursPerWeek} hours a week each, ${p.lengthWeeks} weeks, difficulty ${p.difficulty.toLowerCase()}`,
        ].join("\n"),
      });
  const clean = (t: string) => t.replace(new RegExp(String.fromCharCode(0x2014), "g"), ",");
  await db.$transaction([
    db.draftStep.deleteMany({ where: { projectId } }),
    db.draftStep.createMany({
      data: plan.steps.map((st, i) => ({
        projectId,
        title: clean(st.title),
        activePhrase: clean(st.activePhrase).replace(/\.$/, "").toLowerCase(),
        order: i,
      })),
    }),
  ]);
}
