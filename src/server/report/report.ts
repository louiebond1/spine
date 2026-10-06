import "server-only";
import type { Prisma, User } from "@prisma/client";
import { z } from "zod";
import { monthName } from "@/lib/format";
import { addMonths, parseZoned, startOfMonth, zonedParts } from "@/lib/tz";
import { askClaudeForJson, fixturesEnabled, lenient as L } from "../ai/client";
import { now } from "../clock";
import { db } from "../db";
import { notify } from "../notify/notify";
import { getSettings } from "../settings";

// Monthly leadership report: the facts are counted here; Claude only writes the words around
// them (a headline, a short story, what to watch, what to back next). Like Programme it never
// uses AI scores, speed metrics or rankings of people.

const DAY = 86_400_000;

export const monthKey = (d: Date) => {
  const p = zonedParts(d);
  return `${p.year}-${String(p.month).padStart(2, "0")}`;
};
export const monthStart = (key: string) => parseZoned(`${key}-01`);

/** Admins, plus anyone a rule names as an approver ("leadership"). */
export async function canSeeReport(user: User) {
  if (user.isAdmin) return true;
  return (await db.approvalRule.count({ where: { active: true, approverIds: { has: user.id } } })) > 0;
}

export async function reportReaders() {
  const [admins, rules] = await Promise.all([db.user.findMany({ where: { isAdmin: true }, select: { id: true } }), db.approvalRule.findMany({ where: { active: true }, select: { approverIds: true } })]);
  return [...new Set([...admins.map((a) => a.id), ...rules.flatMap((r) => r.approverIds)])];
}

export type ReportFacts = Awaited<ReturnType<typeof gatherFacts>>;

export async function gatherFacts(key: string) {
  const from = monthStart(key);
  const to = addMonths(from, 1);
  const t = now();
  const settings = await getSettings();
  const [wins, hoursThis, hoursPrev, hoursAll, submitted, asked, resolved, stages, waiting, stalled, recruiting] = await Promise.all([
    db.project.findMany({ where: { liveAt: { gte: from, lt: to } }, select: { title: true, whoBenefits: true, owner: { select: { name: true } }, topic: { select: { name: true } } } }),
    db.impactLog.aggregate({ where: { month: from }, _sum: { hoursSaved: true } }),
    db.impactLog.aggregate({ where: { month: addMonths(from, -1) }, _sum: { hoursSaved: true } }),
    db.impactLog.aggregate({ where: { month: { lte: from } }, _sum: { hoursSaved: true } }),
    db.project.count({ where: { submittedAt: { gte: from, lt: to } } }),
    db.question.count({ where: { postedAt: { gte: from, lt: to } } }),
    db.question.count({ where: { resolvedAt: { gte: from, lt: to } } }),
    db.project.groupBy({ by: ["stage"], _count: true, where: { stage: { not: "IDEA" } } }),
    db.project.findMany({ where: { stage: "APPROVAL" }, select: { title: true, submittedAt: true, buildCompletedAt: true } }),
    db.project.findMany({ where: { stage: "BUILDING", lastActivityAt: { lt: new Date(t.getTime() - settings.stalledBuildDays * DAY) } }, select: { title: true, lastActivityAt: true } }),
    db.project.findMany({ where: { stage: "RECRUITING" }, select: { title: true, teamSize: true, problem: true, _count: { select: { team: true } } } }),
  ]);
  const hourly = settings.hourlyCost ? Number(settings.hourlyCost) : null;
  const programmeCost = settings.programmeCost ? Number(settings.programmeCost) : null;
  const h = hoursThis._sum.hoursSaved ?? 0;
  const total = hoursAll._sum.hoursSaved ?? 0;
  return {
    month: key,
    monthLabel: `${monthName(from)} ${zonedParts(from).year}`,
    partial: to.getTime() > t.getTime(),
    hoursSaved: h,
    hoursSavedLastMonth: hoursPrev._sum.hoursSaved ?? 0,
    hoursSavedToDate: total,
    valueThisMonth: hourly ? Math.round(h * hourly) : null,
    valueToDate: hourly ? Math.round(total * hourly) : null,
    programmeCost,
    wentLive: wins.map((w) => ({ title: w.title, owner: w.owner.name, topic: w.topic.name, forWhom: w.whoBenefits })),
    ideasSubmitted: submitted,
    questionsAsked: asked,
    questionsResolved: resolved,
    pipeline: Object.fromEntries(stages.map((s) => [s.stage, s._count])),
    // Watch items are the state when the report is written, so leadership can act on them now.
    waitingForApproval: waiting.map((w) => ({ title: w.title, days: Math.max(0, Math.floor((t.getTime() - (w.buildCompletedAt ?? w.submittedAt ?? t).getTime()) / DAY)) })),
    stalledBuilds: stalled.map((s) => ({ title: s.title, quietDays: Math.floor((t.getTime() - s.lastActivityAt.getTime()) / DAY) })),
    needPeople: recruiting.map((r) => ({ title: r.title, spots: r.teamSize - r._count.team, problem: r.problem.slice(0, 160) })),
  };
}

const writingSchema = z.object({
  headline: L.text(160),
  story: L.text(700),
  backNext: z
    .array(
      // Accept "Title: why" strings as well as objects.
      z.preprocess((v) => {
        if (typeof v !== "string") return v;
        const i = v.indexOf(":");
        return i > 0 ? { title: v.slice(0, i), why: v.slice(i + 1) } : { title: v, why: "" };
      }, z.object({ title: L.text(80), why: L.text(220) })),
    )
    .default([])
    .transform((a) => a.slice(0, 3)),
  watch: z.array(z.preprocess((v) => (typeof v === "string" ? v : JSON.stringify(v)), L.text(220))).default([]).transform((a) => a.slice(0, 3)),
});
export type ReportWriting = z.infer<typeof writingSchema>;
export type Report = { facts: ReportFacts; writing: ReportWriting; generatedAt: Date };

function fixtureWriting(f: ReportFacts): ReportWriting {
  return {
    headline: `${f.hoursSaved} hours saved in ${f.monthLabel}${f.wentLive.length ? `, with ${f.wentLive.length} new ${f.wentLive.length === 1 ? "tool" : "tools"} live` : ""}.`,
    story: `Teams saved ${f.hoursSaved} hours this month against ${f.hoursSavedLastMonth} the month before. ${f.ideasSubmitted} ideas were submitted and Champions resolved ${f.questionsResolved} questions.`,
    watch: [...f.waitingForApproval.map((w) => `${w.title} has waited ${w.days} days for approval.`), ...f.stalledBuilds.map((s) => `${s.title} has been quiet for ${s.quietDays} days.`)].slice(0, 3),
    backNext: f.needPeople.slice(0, 3).map((n) => ({ title: n.title, why: `Needs ${n.spots} more ${n.spots === 1 ? "person" : "people"} to start building.` })),
  };
}

async function write(f: ReportFacts): Promise<ReportWriting> {
  if (fixturesEnabled()) return fixtureWriting(f);
  return askClaudeForJson({
    schema: writingSchema,
    maxTokens: 1500,
    system: `You write the monthly AI programme report for a company's leadership team. Use only the facts given; never invent numbers or names. Plain, confident English, no hype, no em dashes.
headline: one sentence with the single most important result.
story: 2 to 4 sentences: what changed this month and why it matters to the business (hours and value saved, what went live and for whom, momentum in ideas and questions).${f.partial ? " The month is not over yet, so say 'so far'." : ""}
watch: up to 3 short risks leadership can act on (approvals waiting, quiet builds), each naming the project.
backNext: up to 3 projects worth leadership's backing now (for example ones that need people to start), each with one sentence on why.
Never rank or compare individual people, and don't mention speed metrics.
JSON shape: {"headline":"","story":"","watch":["",""],"backNext":[{"title":"project title","why":"one sentence"}]}`,
    prompt: JSON.stringify(f),
  });
}

/**
 * The saved report for a month, writing it first if needed (or when `refresh`). A finished
 * month keeps the facts it was written from, so the words and numbers always agree; the
 * current month is rewritten when its numbers have moved.
 */
export async function getReport(key: string, { refresh = false } = {}): Promise<Report> {
  const saved = refresh ? null : await db.leadershipReport.findUnique({ where: { month: key } });
  const fresh = await gatherFacts(key);
  if (saved) {
    const content = saved.content as { writing?: unknown; facts?: ReportFacts };
    const parsed = writingSchema.safeParse(content?.writing);
    const keep = content?.facts && (!fresh.partial || JSON.stringify(content.facts) === JSON.stringify(fresh));
    if (parsed.success && keep) return { facts: content.facts!, writing: parsed.data, generatedAt: saved.generatedAt };
  }
  const facts = fresh;
  const writing = await write(facts);
  const t = now();
  const content = { writing, facts } as unknown as Prisma.InputJsonValue;
  await db.leadershipReport.upsert({ where: { month: key }, create: { month: key, content, generatedAt: t }, update: { content, generatedAt: t } });
  return { facts, writing, generatedAt: t };
}

/** Scheduled job: on the first days of a month, write last month's report once and tell leadership. */
export async function publishLastMonthsReport(): Promise<boolean> {
  const last = monthKey(addMonths(startOfMonth(now()), -1));
  if (await db.leadershipReport.findUnique({ where: { month: last } })) return false;
  const r = await getReport(last);
  await notify(await reportReaders(), { kind: "report", title: `Leadership report: ${r.facts.monthLabel}`, body: r.writing.headline, href: `/programme/report?month=${last}` });
  return true;
}
