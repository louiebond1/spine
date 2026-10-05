import "server-only";
import { z } from "zod";
import { longDate } from "@/lib/format";
import { zonedParts } from "@/lib/tz";
import { now } from "../clock";
import { db } from "../db";
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
  buildPath: L.oneOf(["APP", "COWORK_NATIVE"], "COWORK_NATIVE"),
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

async function context() {
  const [topics, people] = await Promise.all([
    db.topic.findMany({ where: { archivedAt: null }, select: { name: true } }),
    db.user.findMany({ select: { name: true } }),
  ]);
  return `Today is ${longDate(now())} (${isoDay(now())}). Topics: ${topics.map((t) => t.name).join(", ")}. People in the company: ${people.map((p) => p.name).join(", ")}.`;
}

const BRIEF_RULES = `Field rules:
- title: product-style name, 2 to 4 words. problem: 2 sentences, the pain today then what the tool does. whoBenefits: the team or role. topic: one of the topics given.
- buildPath: "COWORK_NATIVE" if it can be built inside approved workplace tools (a shared Claude project, prompts, templates, docs); "APP" if it needs infrastructure, hosting, integrations or admin access.
- teamSize, hoursPerWeek, lengthWeeks, difficulty: realistic for a small internal team. teamSize must be at least 1 plus the number of people named.
- targetDate: yyyy-mm-dd in the future; use the date they gave, otherwise today plus lengthWeeks plus a week.
- people: full names of colleagues they mentioned, matched to the people list (never the speaker). Empty if none.
- useCases: 2 to 3 objects {"who","scenario","outcome"}: who is the person, scenario is the specific moment ("Every Monday, a procurement analyst opens..."), outcome is what changes for them. Grounded in what they said.
- successMetric: one measurable sentence. mvpScope: the smallest useful first version. laterScope: what can wait. hoursSavedEstimate: honest hours saved per month across everyone once live.
No em dashes. Never invent company facts beyond what they said; keep estimates modest.`;

/** One sentence in, a complete idea out. */
export async function kickoffFromSentence(sentence: string): Promise<IdeaBrief> {
  if (fixturesEnabled()) return fixtureBrief(sentence);
  return askClaudeForJson({
    system: `You turn one sentence about a new internal AI tool into a complete project proposal.\n${BRIEF_RULES}\nJSON with exactly the fields: title, problem, whoBenefits, topic, buildPath, teamSize, hoursPerWeek, lengthWeeks, difficulty, targetDate, people, useCases, successMetric, mvpScope, laterScope, hoursSavedEstimate.`,
    schema: briefSchema,
    maxTokens: 2500,
    prompt: `${await context()}\n\nTheir sentence: ${sentence}`,
  });
}

const turnSchema = z.object({
  done: z.boolean(),
  question: L.text(300).default(""),
  suggestions: z.array(L.text(100)).default([]).transform((a) => a.slice(0, 4)),
  brief: briefSchema.optional(),
});
export type CoachTurn = z.infer<typeof turnSchema>;

const COACH_SYSTEM = `You are Spine, coaching an employee to turn a rough idea for an internal AI tool into something worth building. Interview them one short question at a time, like a sharp, friendly product manager.
Cover, in a natural order and only what's still unclear: who exactly struggles and how often; a real recent example of the problem; what "done" looks like for them; the data or systems involved (and anything sensitive); who else should help and by when.
Each question: one sentence, specific to what they've said, plus up to 4 short tap-to-answer suggestions they might pick.
After 4 to 6 answers (or sooner if you have enough), set done true and return the full brief.
${BRIEF_RULES}
JSON shape while asking: {"done":false,"question":"","suggestions":[]}. When finished: {"done":true,"question":"","suggestions":[],"brief":{...all brief fields...}}.`;

export async function coachTurn(transcript: { role: "spine" | "user"; text: string }[]): Promise<CoachTurn> {
  if (fixturesEnabled()) return fixtureTurn(transcript);
  const answers = transcript.filter((t) => t.role === "user").length;
  return askClaudeForJson({
    system: COACH_SYSTEM,
    schema: turnSchema,
    maxTokens: 3000,
    prompt: [
      await context(),
      "",
      "Conversation so far:",
      ...transcript.map((t) => `${t.role === "spine" ? "Spine" : "Them"}: ${t.text}`),
      "",
      answers >= 6 ? "You have enough now. Finish with done true and the brief." : "Ask the next most useful question, or finish if you have enough.",
    ].join("\n"),
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
    buildPath: "COWORK_NATIVE",
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

function fixtureTurn(transcript: { role: "spine" | "user"; text: string }[]): CoachTurn {
  const questions = [
    { question: "Who struggles with this most, and how often does it come up?", suggestions: ["My whole team, every week", "Just me, daily", "Another team, monthly"] },
    { question: "Tell me about the last time it happened. What did it cost?", suggestions: ["About an hour of copy and paste", "We missed a deadline", "A client noticed"] },
    { question: "What would 'done' look like for you?", suggestions: ["A summary I can trust", "An alert when something's off", "A first draft I just edit"] },
    { question: "Who should help build it, and by when?", suggestions: ["Me and one other person", "Mia and Ben, by December", "Not sure yet"] },
  ];
  const answers = transcript.filter((t) => t.role === "user");
  if (answers.length <= questions.length - 1 + 1 && answers.length < questions.length + 1) {
    const next = questions[answers.length - 1];
    if (next) return { done: false, ...next };
  }
  return { done: true, question: "", suggestions: [], brief: fixtureBrief(answers.map((a) => a.text).join(". ")) };
}
