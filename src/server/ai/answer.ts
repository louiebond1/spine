import "server-only";
import { z } from "zod";
import { now } from "../clock";
import type { Scope } from "../ctx";
import { playbookContext } from "../playbook/context";
import { askClaudeForJson, fixturesEnabled } from "./client";

// Instant answers: when someone asks the Help Desk, Spine drafts a first answer while a
// Champion still owns the follow-up. Privacy boundary: Spine only learns from answers that the
// asker agreed to share (Question.sharedAt + answerSummary) and from the company playbook.
// Private threads, their messages and attachments are never sent to the model as knowledge.

const STOP = new Set(["what", "when", "with", "this", "that", "have", "from", "into", "your", "does", "should", "would", "could", "there", "their", "about", "claude", "using", "best", "help", "want"]);

function keywords(text: string) {
  return [...new Set(text.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 3 && !STOP.has(w)))].slice(0, 12);
}

/** The most relevant shared answers in this organisation. */
export async function relatedKnowledge(scope: Pick<Scope, "db">, text: string, excludeId?: string) {
  const words = keywords(text);
  if (!words.length) return [];
  const rows = await scope.db.question.findMany({
    where: {
      sharedAt: { not: null },
      answerSummary: { not: null },
      id: excludeId ? { not: excludeId } : undefined,
      OR: words.map((w) => ({ OR: [{ title: { contains: w, mode: "insensitive" as const } }, { answerSummary: { contains: w, mode: "insensitive" as const } }] })),
    },
    select: { id: true, title: true, answerSummary: true },
    take: 40,
  });
  return rows
    .map((q) => ({ id: q.id, title: q.title, answer: q.answerSummary ?? "", score: words.filter((w) => `${q.title} ${q.answerSummary}`.toLowerCase().includes(w)).length }))
    .filter((k) => k.score >= 2 && k.answer)
    .sort((a, b) => b.score - a.score)
    .slice(0, 4);
}

const answerSchema = z.object({
  answer: z.string().min(10).max(1500),
  usedSourceIds: z.array(z.string()).max(4),
});

const SYSTEM = `You help employees use AI at work. Draft a short, practical first answer to their Help Desk question.
- Follow the company's playbook when it's given: only recommend approved tools, and respect its data rules. If they ask about a tool that isn't approved, say so plainly and point to an approved alternative if there is one.
- If the company's earlier shared answers are relevant, build on them and list their ids in usedSourceIds.
- Otherwise answer from general knowledge, and say a Champion will confirm anything company-specific.
- 2 to 5 short sentences or a few "- " bullets. Plain English, no headings, no em dashes.
JSON shape: {"answer":"","usedSourceIds":[]}`;

export async function generateSuggestedAnswer(scope: Scope, questionId: string) {
  const q = await scope.db.question.findUnique({ where: { id: questionId }, include: { topic: true } });
  if (!q || q.status === "RESOLVED") return;
  const [sources, playbook] = await Promise.all([relatedKnowledge(scope, `${q.title} ${q.body}`, q.id), playbookContext(scope)]);

  const result = fixturesEnabled()
    ? sources.length
      ? { answer: `${sources[0]!.answer.split("\n")[0]}\n\nA Champion can confirm the details for your case.`, usedSourceIds: [sources[0]!.id] }
      : { answer: "A Champion will pick this up shortly. In the meantime, check the Playbook for approved tools and what data you can use with them.", usedSourceIds: [] }
    : await askClaudeForJson({
        scope,
        feature: "instant_answer",
        system: SYSTEM,
        schema: answerSchema,
        maxTokens: 1500,
        prompt: [
          playbook ?? "The company has not published a playbook yet.",
          "",
          `Topic: ${q.topic.name}`,
          `Question: ${q.title}`,
          `Details: ${q.body}`,
          "",
          sources.length ? "Earlier answers the company has shared:" : "No shared answers match.",
          ...sources.map((s) => `- id ${s.id}: "${s.title}" answered: ${s.answer.slice(0, 600)}`),
        ].join("\n"),
      });

  const valid = new Set(sources.map((s) => s.id));
  await scope.db.question.update({
    where: { id: questionId },
    data: {
      aiAnswer: result.answer.replace(new RegExp(String.fromCharCode(0x2014), "g"), ","),
      aiAnswerSources: result.usedSourceIds.filter((id) => valid.has(id)),
      aiAnswerAt: now(),
    },
  });
}
