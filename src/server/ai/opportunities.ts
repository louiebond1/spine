import "server-only";
import { z } from "zod";
import { now } from "../clock";
import { db } from "../db";
import { askClaudeForJson, fixturesEnabled } from "./client";

// Spotted by Spine: when several people keep asking the Help Desk about the same thing,
// that's a project waiting to happen. Spine clusters recent questions by shared subject
// and writes each strong cluster up as an idea, with the questions as evidence.

const WINDOW_DAYS = 120;
const MIN_QUESTIONS = 3;
const MAX_NEW_PER_SCAN = 3;

const STOP = new Set([
  "claude", "with", "what", "when", "into", "from", "this", "that", "have", "should", "could", "would", "does", "using", "best", "make",
  "help", "turn", "write", "draft", "create", "can", "how", "the", "for", "and", "use", "get", "my", "our", "your", "before", "after",
  "two", "three", "first", "short", "simple", "plain", "english", "team", "work", "explain", "file", "check", "compare",
]);

const words = (text: string) => [...new Set(text.toLowerCase().split(/[^a-z]+/).filter((w) => w.length > 3 && !STOP.has(w)).map((w) => w.replace(/(ies)$/, "y").replace(/s$/, "")))];

type Q = { id: string; title: string; topic: string; askerId: string };

/** Groups of at least three recent questions sharing a subject word, strongest first. */
export async function findQuestionClusters() {
  const since = new Date(now().getTime() - WINDOW_DAYS * 86_400_000);
  const questions: Q[] = (
    await db.question.findMany({ where: { postedAt: { gte: since } }, select: { id: true, title: true, askerId: true, topic: { select: { name: true } } } })
  ).map((q) => ({ id: q.id, title: q.title, topic: q.topic.name, askerId: q.askerId }));

  const byWord = new Map<string, Q[]>();
  for (const q of questions) for (const w of words(q.title)) byWord.set(w, [...(byWord.get(w) ?? []), q]);

  const clusters = [...byWord.entries()]
    .filter(([, qs]) => qs.length >= MIN_QUESTIONS && qs.length <= 15 && new Set(qs.map((q) => q.askerId)).size >= 2)
    .map(([word, qs]) => ({ key: word, questions: qs }))
    .sort((a, b) => b.questions.length - a.questions.length);

  // Drop clusters that mostly repeat a stronger one.
  const kept: typeof clusters = [];
  for (const c of clusters) {
    const ids = new Set(c.questions.map((q) => q.id));
    if (kept.some((k) => k.questions.filter((q) => ids.has(q.id)).length / ids.size > 0.5)) continue;
    kept.push(c);
  }
  return kept;
}

const pitchSchema = z.object({
  worthIt: z.boolean(),
  title: z.string().min(3).max(80),
  problem: z.string().min(10).max(600),
  whoBenefits: z.string().min(2).max(120),
  topic: z.string().max(40),
});

const SYSTEM = `People in a company keep asking their AI Help Desk about the same thing. Decide whether a small internal AI project would remove the need to keep asking, and if so pitch it.
- worthIt: false if the questions are unrelated, already covered by an existing project, or a one-off answer would do.
- title: a short product-style name (2 to 4 words), like "Client Data Scrubber".
- problem: 1 to 2 sentences in plain English starting from what people keep asking.
- whoBenefits: who would use it.
- topic: the best matching topic from the list given.
No em dashes. JSON shape: {"worthIt":true,"title":"","problem":"","whoBenefits":"","topic":""}`;

/** Finds new clusters and writes up to three new opportunities. Safe to run often. */
export async function scanOpportunities() {
  const [clusters, existing, projects, topics] = await Promise.all([
    findQuestionClusters(),
    db.opportunity.findMany({ select: { clusterKey: true } }),
    db.project.findMany({ select: { title: true, problem: true } }),
    db.topic.findMany({ where: { archivedAt: null }, select: { id: true, name: true } }),
  ]);
  const seen = new Set(existing.map((e) => e.clusterKey));
  let created = 0;

  for (const cluster of clusters) {
    if (created >= MAX_NEW_PER_SCAN) break;
    if (seen.has(cluster.key)) continue;

    const pitch = fixturesEnabled()
      ? {
          worthIt: true,
          title: `${cluster.key.charAt(0).toUpperCase()}${cluster.key.slice(1)} Assistant`,
          problem: `${cluster.questions.length} people have asked the Help Desk about ${cluster.key} recently. A shared assistant would answer this once for everyone.`,
          whoBenefits: "Everyone who keeps asking",
          topic: cluster.questions[0]!.topic,
        }
      : await askClaudeForJson({
          system: SYSTEM,
          schema: pitchSchema,
          maxTokens: 800,
          prompt: [
            `Questions about "${cluster.key}":`,
            ...cluster.questions.map((q) => `- [${q.topic}] ${q.title}`),
            "",
            `Existing projects: ${projects.map((p) => p.title).join("; ")}`,
            `Topics: ${topics.map((t) => t.name).join(", ")}`,
          ].join("\n"),
        });

    // Record every cluster we looked at, so a "not worth it" verdict isn't re-asked each scan.
    const topic = topics.find((t) => t.name.toLowerCase() === pitch.topic.toLowerCase());
    await db.opportunity.create({
      data: {
        clusterKey: cluster.key,
        title: pitch.title.replace(new RegExp(String.fromCharCode(0x2014), "g"), ","),
        problem: pitch.problem.replace(new RegExp(String.fromCharCode(0x2014), "g"), ","),
        whoBenefits: pitch.whoBenefits,
        topicId: topic?.id ?? null,
        evidenceIds: cluster.questions.map((q) => q.id),
        status: pitch.worthIt ? "OPEN" : "DISMISSED",
      },
    });
    if (pitch.worthIt) created++;
  }
  await db.settings.update({ where: { id: "singleton" }, data: { opportunitiesScannedAt: now() } });
  return created;
}
