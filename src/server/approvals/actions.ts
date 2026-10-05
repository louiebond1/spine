"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { askClaudeForJson, fixturesEnabled, lenient as L } from "../ai/client";
import { db } from "../db";
import { assert, can } from "../permissions";
import { getCurrentUser } from "../session";
import { describeRule } from "./rules";

const ruleInput = z.object({
  name: z.string().trim().min(2, "Give the rule a name.").max(80),
  topicIds: z.array(z.string()).default([]),
  buildPaths: z.array(z.enum(["APP", "COWORK_NATIVE"])).default([]),
  difficulties: z.array(z.enum(["EASY", "MODERATE", "HARD"])).default([]),
  minTotalHours: z.number().int().min(0).max(100000).nullable().default(null),
  maxTotalHours: z.number().int().min(0).max(100000).nullable().default(null),
  onlyWithConcerns: z.boolean().default(false),
  approverIds: z.array(z.string()).default([]),
  requireAll: z.boolean().default(false),
  autoApproveDays: z.number().int().min(1).max(90).nullable().default(null),
  fastTrack: z.boolean().default(false),
});
export type RuleInput = z.infer<typeof ruleInput>;

async function admin() {
  const user = await getCurrentUser();
  assert(can.manage(user), "Only admins can change approval rules.");
  return user;
}

async function names() {
  const [topics, users] = await Promise.all([db.topic.findMany({ select: { id: true, name: true } }), db.user.findMany({ select: { id: true, name: true } })]);
  return { topics: new Map(topics.map((t) => [t.id, t.name])), users: new Map(users.map((u) => [u.id, u.name])) };
}

export async function saveRule(id: string | null, raw: unknown): Promise<{ ok: true } | { ok: false; error: string }> {
  await admin();
  const parsed = ruleInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the rule." };
  const r = parsed.data;
  if (r.minTotalHours != null && r.maxTotalHours != null && r.minTotalHours > r.maxTotalHours) return { ok: false, error: "The minimum hours is above the maximum." };
  const known = await db.user.count({ where: { id: { in: r.approverIds } } });
  if (known !== r.approverIds.length) return { ok: false, error: "One of the approvers no longer exists." };
  if (id) {
    await db.approvalRule.update({ where: { id }, data: r });
  } else {
    const last = await db.approvalRule.findFirst({ orderBy: { position: "desc" } });
    await db.approvalRule.create({ data: { ...r, position: (last?.position ?? -1) + 1 } });
  }
  revalidatePath("/admin");
  return { ok: true };
}

export async function deleteRule(id: string) {
  await admin();
  await db.approvalRule.delete({ where: { id } });
  revalidatePath("/admin");
}

export async function toggleRule(id: string, active: boolean) {
  await admin();
  await db.approvalRule.update({ where: { id }, data: { active } });
  revalidatePath("/admin");
}

/** Rules are checked top to bottom; the first match wins. */
export async function moveRule(id: string, direction: "up" | "down") {
  await admin();
  const rules = await db.approvalRule.findMany({ orderBy: [{ position: "asc" }, { createdAt: "asc" }] });
  const i = rules.findIndex((r) => r.id === id);
  const j = direction === "up" ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= rules.length) return;
  [rules[i], rules[j]] = [rules[j]!, rules[i]!];
  await db.$transaction(rules.map((r, position) => db.approvalRule.update({ where: { id: r.id }, data: { position } })));
  revalidatePath("/admin");
}

/** Live preview sentence for the rule editor. */
export async function previewRule(raw: unknown): Promise<string> {
  await admin();
  const parsed = ruleInput.safeParse({ name: "Preview", ...(raw as object) });
  if (!parsed.success) return "";
  return describeRule(parsed.data, await names());
}

// ---------------------------------------------------------------------------
// Describe a rule in plain English and Spine writes it
// ---------------------------------------------------------------------------

const draftSchema = z.object({
  name: L.text(80),
  topics: z.array(L.text(40)).default([]),
  buildPaths: z.array(L.oneOf(["APP", "COWORK_NATIVE"], "APP")).default([]),
  difficulties: z.array(L.oneOf(["EASY", "MODERATE", "HARD"], "MODERATE")).default([]),
  minTotalHours: z.preprocess((v) => (v == null || v === "" ? null : Math.max(0, Math.round(Number(v)) || 0)), z.number().nullable()).default(null),
  maxTotalHours: z.preprocess((v) => (v == null || v === "" ? null : Math.max(0, Math.round(Number(v)) || 0)), z.number().nullable()).default(null),
  onlyWithConcerns: z.boolean().default(false),
  approvers: z.array(L.text(60)).default([]),
  requireAll: z.boolean().default(false),
  autoApproveDays: z.preprocess((v) => (v == null || v === "" ? null : Math.min(90, Math.max(1, Math.round(Number(v)) || 7))), z.number().nullable()).default(null),
  fastTrack: z.boolean().default(false),
});

export async function draftRuleFromText(text: string): Promise<{ ok: true; rule: RuleInput; sentence: string; unknown: string[] } | { ok: false; error: string }> {
  await admin();
  const t = text.trim().slice(0, 1000);
  if (t.length < 8) return { ok: false, error: "Describe the rule in a sentence first." };
  const [topics, users] = await Promise.all([db.topic.findMany({ where: { archivedAt: null }, select: { id: true, name: true } }), db.user.findMany({ select: { id: true, name: true } })]);

  let d: z.infer<typeof draftSchema>;
  try {
    d = fixturesEnabled()
      ? fixtureDraft(t, topics.map((x) => x.name), users.map((u) => u.name))
      : await askClaudeForJson({
          schema: draftSchema,
          maxTokens: 800,
          system: `You turn an admin's plain-English approval policy into one structured rule for Spine, an internal AI ideas platform.
Fields: name (short label), topics (from the topic list, empty = any), buildPaths ("APP" needs infrastructure; "COWORK_NATIVE" is built in workplace tools; empty = any), difficulties (EASY, MODERATE, HARD; empty = any), minTotalHours / maxTotalHours (total effort = team size x hours per week x weeks; null = no limit), onlyWithConcerns (true if it only applies when the AI review raised concerns), approvers (full names from the people list; empty = any admin), requireAll (true if every approver must sign off), autoApproveDays (number, or null for never auto-approve; if not mentioned use 7 unless they want sign-off guaranteed), fastTrack (true if matching ideas should be approved straight away with no review; then approvers are empty).
Only use topics and people from the lists. No em dashes.`,
          prompt: `Topics: ${topics.map((x) => x.name).join(", ")}\nPeople: ${users.map((u) => u.name).join(", ")}\n\nPolicy: ${t}`,
        });
  } catch (error) {
    console.error("[approvals] draft failed", error);
    return { ok: false, error: "Spine couldn't turn that into a rule just now. Try again." };
  }

  const unknown: string[] = [];
  const findTopic = (n: string) => topics.find((x) => x.name.toLowerCase() === n.toLowerCase());
  const findUser = (n: string) => {
    const s = n.toLowerCase();
    const exact = users.find((u) => u.name.toLowerCase() === s);
    const first = users.filter((u) => u.name.split(" ")[0]!.toLowerCase() === s.split(" ")[0]);
    return exact ?? (first.length === 1 ? first[0] : undefined);
  };
  const topicIds = d.topics.map((n) => findTopic(n)?.id ?? (unknown.push(n), null)).filter((x): x is string => !!x);
  const approverIds = d.fastTrack ? [] : [...new Set(d.approvers.map((n) => findUser(n)?.id ?? (unknown.push(n), null)).filter((x): x is string => !!x))];
  const rule: RuleInput = {
    name: d.name || "New rule",
    topicIds,
    buildPaths: [...new Set(d.buildPaths)],
    difficulties: [...new Set(d.difficulties)],
    minTotalHours: d.minTotalHours,
    maxTotalHours: d.maxTotalHours,
    onlyWithConcerns: d.onlyWithConcerns,
    approverIds,
    requireAll: approverIds.length > 1 && d.requireAll,
    autoApproveDays: d.fastTrack ? null : d.autoApproveDays,
    fastTrack: d.fastTrack,
  };
  return { ok: true, rule, sentence: describeRule(rule, await names()), unknown };
}

/** Local development without an API key: keyword reading of the policy. */
function fixtureDraft(text: string, topics: string[], people: string[]): z.infer<typeof draftSchema> {
  const s = text.toLowerCase();
  const fast = /fast.?track|straight away|automatically approve|skip/.test(s);
  const hours = s.match(/(over|more than|above|at least)\s+(\d+)\s*hours?/);
  const under = s.match(/(under|less than|below|at most)\s+(\d+)\s*hours?/);
  const days = s.match(/(\d+)\s*days?/);
  return {
    name: fast ? "Fast track small ideas" : "Leadership sign-off",
    topics: topics.filter((t) => s.includes(t.toLowerCase())),
    buildPaths: /cowork/.test(s) ? ["COWORK_NATIVE"] : /\bapps?\b/.test(s) ? ["APP"] : [],
    difficulties: (["EASY", "MODERATE", "HARD"] as const).filter((d) => s.includes(d.toLowerCase())),
    minTotalHours: hours ? Number(hours[2]) : null,
    maxTotalHours: under ? Number(under[2]) : null,
    onlyWithConcerns: /concern/.test(s),
    approvers: people.filter((p) => s.includes(p.split(" ")[0]!.toLowerCase())),
    requireAll: /\b(both|all)\b/.test(s),
    autoApproveDays: /never/.test(s) ? null : days ? Number(days[1]) : 7,
    fastTrack: fast,
  };
}
