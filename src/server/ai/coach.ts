import "server-only";
import { z } from "zod";
import { longDate } from "@/lib/format";
import { zonedParts } from "@/lib/tz";
import { now } from "../clock";
import type { Scope } from "../ctx";
import { playbookContext } from "../playbook/context";
import { askClaudeForJson, fixturesEnabled, lenient as L } from "./client";

// "Start with Spine": turn one sentence into a full idea, or coach someone through it with a
// short interview that ends in a brief with real use cases, a success measure and an MVP.

const isoDay = (d: Date) => {
  const p = zonedParts(d);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
};

export const briefSchema = z.object({
  title: L.text(60).pipe(z.string().min(3)),
  problem: L.text(800).pipe(z.string().min(10)),
  whoBenefits: L.text(120).pipe(z.string().min(2)),
  topic: L.text(40),
  teamSize: L.int(1, 10, 2),
  hoursPerWeek: L.int(1, 10, 2),
  lengthWeeks: L.int(1, 12, 4),
  difficulty: L.oneOf(["EASY", "MODERATE", "HARD"], "MODERATE"),
  targetDate: L.date(),
  people: z.array(L.text(60)).default([]).transform((a) => a.filter(Boolean).slice(0, 9)),
  useCases: z
    .array(
      z.preprocess(
        (u) => {
          const o = (u ?? {}) as Record<string, unknown>;
          return { who: o.who ?? o.persona ?? o.role, scenario: o.scenario ?? o.moment ?? o.situation ?? o.story ?? o.description, outcome: o.outcome ?? o.result };
        },
        z.object({ who: L.text(80), scenario: L.text(400), outcome: L.text(200) }),
      ),
    ).default([]).transform((a) => a.slice(0, 4)),
  successMetric: L.text(240).default(""),
  mvpScope: L.text(400).default(""),
  laterScope: L.text(400).default(""),
  hoursSavedEstimate: L.int(0, 5000, 0).default(0),
});
export type IdeaBrief = z.infer<typeof briefSchema>;

async function context(scope: Scope) {
  const [topics, people, playbook] = await Promise.all([
    scope.db.topic.findMany({ where: { archivedAt: null }, select: { name: true } }),
    scope.db.user.findMany({ where: { status: "ACTIVE" }, select: { name: true } }),
    playbookContext(scope),
  ]);
  return [
    `Today is ${longDate(now())} (${isoDay(now())}). Topics: ${topics.map((t) => t.name).join(", ")}. People in the company: ${people.map((p) => p.name).join(", ")}.`,
    playbook ? `${playbook}
Prefer approved tools. If the idea depends on a tool that is not approved, say so in the problem text.` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

const BRIEF_RULES = `Field rules:
- title: product-style name, 2 to 4 words. problem: 2 sentences, the pain today then what the tool does. whoBenefits: the team or role. topic: one of the topics given.
- teamSize, hoursPerWeek, lengthWeeks, difficulty: realistic for a small internal team. teamSize must be at least 1 plus the number of people named.
- targetDate: yyyy-mm-dd in the future; use the date they gave, otherwise today plus lengthWeeks plus a week.
- people: full names of colleagues they mentioned, matched to the people list (never the speaker). Empty if none.
- useCases: 2 to 3 objects {"who","scenario","outcome"}: who is the person, scenario is the specific moment ("Every Monday, a procurement analyst opens..."), outcome is what changes for them. Grounded in what they said.
- successMetric: one measurable sentence. mvpScope: the smallest useful first version. laterScope: what can wait. hoursSavedEstimate: honest hours saved per month across everyone once live.
No em dashes. Never invent company facts beyond what they said; keep estimates modest.`;

/** One sentence in, a complete idea out. */
export async function kickoffFromSentence(scope: Scope, sentence: string): Promise<IdeaBrief> {
  if (fixturesEnabled()) return fixtureBrief(sentence);
  return askClaudeForJson({
    scope,
    feature: "idea_draft",
    system: `You turn one sentence about a new internal AI tool into a complete project proposal.\n${BRIEF_RULES}\nJSON with exactly the fields: title, problem, whoBenefits, topic, teamSize, hoursPerWeek, lengthWeeks, difficulty, targetDate, people, useCases, successMetric, mvpScope, laterScope, hoursSavedEstimate.`,
    schema: briefSchema,
    maxTokens: 2500,
    prompt: `${await context(scope)}\n\nTheir sentence: ${sentence}`,
  });
}

// ---------------------------------------------------------------------------
// Local development without an API key
// ---------------------------------------------------------------------------

function fixtureBrief(text: string): IdeaBrief {
  const t = now().getTime();
  const words = text.replace(/[^a-zA-Z ]/g, " ").split(/\s+/).filter((w) => w.length > 3);
  const title = words.slice(0, 3).map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ") || "New Assistant";
  const people = ["Mia Thompson", "Ben Carter", "Jamie Chen", "Sarah Kim", "Louie Morris", "Priya Shah"].filter((n) => text.toLowerCase().includes(n.split(" ")[0]!.toLowerCase()));
  return {
    title,
    problem: `${text.trim().replace(/\.?$/, ".")} Today this is done by hand and takes time every week.`,
    whoBenefits: "The team doing this work",
    topic: "Productivity",
    teamSize: people.length + 1,
    hoursPerWeek: 2,
    lengthWeeks: 4,
    difficulty: "MODERATE",
    targetDate: isoDay(new Date(t + 35 * 86_400_000)),
    people,
    useCases: [
      { who: "A team member", scenario: "On Monday morning they open the assistant and ask for this week's summary.", outcome: "They start the week with what matters, without digging." },
      { who: "A manager", scenario: "Before a client call they ask for the key points in one place.", outcome: "Ten minutes of prep instead of an hour." },
    ],
    successMetric: "Half the team uses it weekly within a month of going Live.",
    mvpScope: "One shared assistant with clear instructions and three example prompts.",
    laterScope: "Connections to other systems and automatic weekly runs.",
    hoursSavedEstimate: 12,
  };
}
