import "server-only";
import { z } from "zod";
import { now } from "../clock";
import { db } from "../db";
import { askClaudeForJson, fixturesEnabled } from "./client";

// Instant answers: when someone asks the Help Desk, Spine drafts an answer from the
// company's own resolved threads (and general knowledge where they don't cover it), so the
// asker gets help in seconds while a Champion still owns the follow-up.

const STOP = new Set(["what", "when", "with", "this", "that", "have", "from", "into", "your", "does", "should", "would", "could", "there", "their", "about", "claude", "using", "best", "help", "want"]);

function keywords(text: string) {
  return [...new Set(text.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 3 && !STOP.has(w)))].slice(0, 12);
}

/** The most relevant resolved threads, with only the Champion's answers (never who asked). */
export async function relatedKnowledge(text: string, excludeId?: string) {
  const words = keywords(text);
  if (!words.length) return [];
  const rows = await db.question.findMany({
    where: {
      status: "RESOLVED",
      id: excludeId ? { not: excludeId } : undefined,
      OR: words.map((w) => ({ OR: [{ title: { contains: w, mode: "insensitive" as const } }, { body: { contains: w, mode: "insensitive" as const } }] })),
    },
    include: { messages: { orderBy: { sentAt: "asc" } } },
    take: 40,
  });
  return rows
    .map((q) => ({
      id: q.id,
      title: q.title,
      answer: q.messages.filter((m) => m.authorId === q.claimerId).map((m) => m.body).join("\n\n"),
      score: words.filter((w) => `${q.title} ${q.body}`.toLowerCase().includes(w)).length,
    }))
    .filter((k) => k.score >= 2 && k.answer)
    .sort((a, b) => b.score - a.score)
    .slice(0, 4);
}

const answerSchema = z.object({
  answer: z.string().min(10).max(1500),
  usedSourceIds: z.array(z.string()).max(4),
});

const SYSTEM = `You help employees use AI at work. Draft a short, practical first answer to their Help Desk question.
- If the company's earlier answers (given below) are relevant, build on them and list their ids in usedSourceIds.
- Otherwise answer from general knowledge, and say a Champion will confirm anything company-specific (policy, data, security).
- 2 to 5 short sentences or a few "- " bullets. Plain English, no headings, no em dashes.
JSON shape: {"answer":"","usedSourceIds":[]}`;

export async function generateSuggestedAnswer(questionId: string) {
  const q = await db.question.findUnique({ where: { id: questionId }, include: { topic: true } });
  if (!q || q.status === "RESOLVED") return;
  const sources = await relatedKnowledge(`${q.title} ${q.body}`, q.id);

  const result = fixturesEnabled()
    ? sources.length
      ? { answer: `${sources[0]!.answer.split("\n")[0]}\n\nA Champion can confirm the details for your case.`, usedSourceIds: [sources[0]!.id] }
      : { answer: "A Champion will pick this up shortly. In the meantime, try describing the task to Claude step by step and attach an example of what you want.", usedSourceIds: [] }
    : await askClaudeForJson({
        system: SYSTEM,
        schema: answerSchema,
        maxTokens: 1500,
        prompt: [
          `Topic: ${q.topic.name}`,
          `Question: ${q.title}`,
          `Details: ${q.body}`,
          "",
          sources.length ? "Earlier answers from the company's Champions:" : "No earlier answers match.",
          ...sources.map((s) => `- id ${s.id}: "${s.title}" answered: ${s.answer.slice(0, 600)}`),
        ].join("\n"),
      });

  const valid = new Set(sources.map((s) => s.id));
  await db.question.update({
    where: { id: questionId },
    data: {
      aiAnswer: result.answer.replace(new RegExp(String.fromCharCode(0x2014), "g"), ","),
      aiAnswerSources: result.usedSourceIds.filter((id) => valid.has(id)),
      aiAnswerAt: now(),
    },
  });
}
