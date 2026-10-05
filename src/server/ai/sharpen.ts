"use server";

import { z } from "zod";
import { db } from "../db";
import { getCurrentUser } from "../session";
import { askClaudeForJson, fixturesEnabled } from "./client";

// Sharpen with Spine: turns a rough idea into a crisp proposal and suggests realistic
// resourcing. The owner decides whether to use it; nothing is saved here.

const inputSchema = z.object({
  title: z.string().max(200),
  problem: z.string().max(3000),
  whoBenefits: z.string().max(200),
  buildPath: z.enum(["APP", "COWORK_NATIVE"]),
});

const outputSchema = z.object({
  title: z.string().min(3).max(60),
  problem: z.string().min(20).max(600),
  whoBenefits: z.string().min(2).max(100),
  topic: z.string().max(40),
  teamSize: z.number().int().min(1).max(10),
  lengthWeeks: z.number().int().min(1).max(12),
  difficulty: z.enum(["EASY", "MODERATE", "HARD"]),
  tip: z.string().max(240),
});

export type Sharpened = z.infer<typeof outputSchema> & { topicId: string | null };

const SYSTEM = `You help employees turn a rough idea for an internal AI tool into a clear proposal for leadership.
- title: a short product-style name, 2 to 4 words.
- problem: 2 sentences. First the pain today (who, how often, what it costs), then what the tool would do. Concrete, no hype.
- whoBenefits: the team or role.
- topic: the best match from the topics given.
- teamSize, lengthWeeks, difficulty: realistic for a small internal team spending a few hours a week.
- tip: one sentence on the single thing that would make this proposal stronger.
Keep the person's intent; don't invent facts about the company. No em dashes.
JSON shape: {"title":"","problem":"","whoBenefits":"","topic":"","teamSize":3,"lengthWeeks":4,"difficulty":"MODERATE","tip":""}`;

export async function sharpenIdea(raw: z.input<typeof inputSchema>): Promise<{ ok: true; result: Sharpened } | { ok: false; error: string }> {
  await getCurrentUser();
  const input = inputSchema.safeParse(raw);
  if (!input.success) return { ok: false, error: "Add a few words about the idea first." };
  const { title, problem, whoBenefits, buildPath } = input.data;
  if (`${title} ${problem}`.trim().length < 12) return { ok: false, error: "Write a sentence about the idea first, then Spine can sharpen it." };

  const topics = await db.topic.findMany({ where: { archivedAt: null }, select: { id: true, name: true } });
  try {
    const result = fixturesEnabled()
      ? {
          title: title.trim() || "New Assistant",
          problem: `${problem.trim().replace(/\.?$/, ".")} Today this takes time every week; an assistant would do the first pass automatically.`,
          whoBenefits: whoBenefits || "The team doing this work",
          topic: topics[0]?.name ?? "",
          teamSize: 3,
          lengthWeeks: 4,
          difficulty: "MODERATE" as const,
          tip: "Add how often this happens and roughly how long it takes today.",
        }
      : await askClaudeForJson({
          system: SYSTEM,
          schema: outputSchema,
          maxTokens: 1200,
          prompt: [
            `Name so far: ${title || "(none)"}`,
            `Problem as written: ${problem || "(none)"}`,
            `Who benefits as written: ${whoBenefits || "(none)"}`,
            `Build path: ${buildPath === "APP" ? "App" : "Cowork-native (within approved workplace tools)"}`,
            `Topics: ${topics.map((t) => t.name).join(", ")}`,
          ].join("\n"),
        });
    const clean = (s: string) => s.replace(new RegExp(String.fromCharCode(0x2014), "g"), ",");
    const topic = topics.find((t) => t.name.toLowerCase() === result.topic.toLowerCase());
    return {
      ok: true,
      result: { ...result, title: clean(result.title), problem: clean(result.problem), tip: clean(result.tip), topicId: topic?.id ?? null },
    };
  } catch {
    return { ok: false, error: "Spine couldn't sharpen this just now. Try again." };
  }
}
