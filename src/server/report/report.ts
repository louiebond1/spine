import "server-only";
import type { Prisma, User } from "@prisma/client";
import { z } from "zod";
import { longDate, monthName } from "@/lib/format";
import { addMonths, parseZoned, startOfMonth, zonedParts } from "@/lib/tz";
import { askClaudeForJson, fixturesEnabled, lenient as L } from "../ai/client";
import { now } from "../clock";
import type { Scope } from "../ctx";
import { notify } from "../notify/notify";
import { getSettings } from "../settings";

// Monthly leadership report. Facts are counted here; Claude only writes the words around them.
// Hours saved count only outcomes verified by someone outside the team; reported but unverified
// hours are shown separately. Never uses AI scores, speed metrics or rankings of people.

const DAY = 86_400_000;

export const monthKey = (d: Date) => {
  const p = zonedParts(d);
  return `${p.year}-${String(p.month).padStart(2, "0")}`;
};
export const monthStart = (key: string) => parseZoned(`${key}-01`);

/** Admins, plus anyone an approval rule names as an approver ("leadership"). */
export async function canSeeReport(scope: Pick<Scope, "db">, user: User) {
  if (user.isAdmin) return true;
  return (await scope.db.approvalRule.count({ where: { active: true, approverIds: { has: user.id } } })) > 0;
}

export async function reportReaders(scope: Pick<Scope, "db">) {
  const [admins, rules] = await Promise.all([
    scope.db.user.findMany({ where: { isAdmin: true, status: "ACTIVE" }, select: { id: true } }),
    scope.db.approvalRule.findMany({ where: { active: true }, select: { approverIds: true } }),
  ]);
  return [...new Set([...admins.map((a) => a.id), ...rules.flatMap((r) => r.approverIds)])];
}

export type ReportFacts = Awaited<ReturnType<typeof gatherFacts>>;

export async function gatherFacts(scope: Scope, key: string) {
  const { db } = scope;
  const org = { project: { orgId: scope.org.id } };
  const from = monthStart(key);
  const to = addMonths(from, 1);
  const t = now();
  const settings = await getSettings(scope);
  const verified = { verifiedAt: { not: null } };
  const [wins, hoursThis, hoursPrev, hoursAll, unverifiedThis, submitted, asked, resolved, shared, stages, waiting, stalled, blocked, recruiting] = await Promise.all([
    db.project.findMany({ where: { liveAt: { gte: from, lt: to } }, select: { title: true, whoBenefits: true, owner: { select: { name: true } }, topic: { select: { name: true } } } }),
    db.impactLog.aggregate({ where: { ...org, ...verified, month: from }, _sum: { hoursSaved: true } }),
    db.impactLog.aggregate({ where: { ...org, ...verified, month: addMonths(from, -1) }, _sum: { hoursSaved: true } }),
    db.impactLog.aggregate({ where: { ...org, ...verified, month: { lte: from } }, _sum: { hoursSaved: true } }),
    db.impactLog.aggregate({ where: { ...org, verifiedAt: null, month: from }, _sum: { hoursSaved: true } }),
    db.project.count({ where: { submittedAt: { gte: from, lt: to } } }),
    db.question.count({ where: { postedAt: { gte: from, lt: to } } }),
    db.question.count({ where: { resolvedAt: { gte: from, lt: to } } }),
    db.question.count({ where: { sharedAt: { gte: from, lt: to } } }),
    db.project.groupBy({ by: ["stage"], _count: true, where: { stage: { not: "IDEA" } } }),
    db.project.findMany({ where: { stage: "APPROVAL" }, select: { title: true, submittedAt: true, buildCompletedAt: true } }),
    db.project.findMany({ where: { stage: "BUILDING", lastActivityAt: { lt: new Date(t.getTime() - settings.stalledBuildDays * DAY) } }, select: { title: true, lastActivityAt: true } }),
    db.project.findMany({ where: { blockedAt: { not: null } }, select: { title: true, blockedAt: true, blockerNote: true } }),
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
    hoursAwaitingVerification: unverifiedThis._sum.hoursSaved ?? 0,
    valueThisMonth: hourly ? Math.round(h * hourly) : null,
    valueToDate: hourly ? Math.round(total * hourly) : null,
    programmeCost,
    wentLive: wins.map((w) => ({ title: w.title, owner: w.owner.name, topic: w.topic.name, forWhom: w.whoBenefits })),
    ideasSubmitted: submitted,
    questionsAsked: asked,
    questionsResolved: resolved,
    answersShared: shared,
    pipeline: Object.fromEntries(stages.map((s) => [s.stage, s._count])),
    /** Watch items describe the state on this date, not the month (labelled as such in the report). */
    watchAsOf: longDate(t),
    waitingForApproval: waiting.map((w) => ({ title: w.title, days: Math.max(0, Math.floor((t.getTime() - (w.buildCompletedAt ?? w.submittedAt ?? t).getTime()) / DAY)) })),
    stalledBuilds: stalled.map((s) => ({ title: s.title, quietDays: Math.floor((t.getTime() - s.lastActivityAt.getTime()) / DAY) })),
    blocked: blocked.map((b) => ({ title: b.title, days: Math.floor((t.getTime() - b.blockedAt!.getTime()) / DAY), note: (b.blockerNote ?? "").slice(0, 160) })),
    needPeople: recruiting.map((r) => ({ title: r.title, spots: r.teamSize - r._count.team, problem: r.problem.slice(0, 160) })),
  };
}

const writingSchema = z.object({
  headline: L.text(160),
  story: L.text(700),
  backNext: z
    .array(
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
export type Report = { facts: ReportFacts; writing: ReportWriting; generatedAt: Date; aiError?: boolean };

/** Plain, fact-only writing used in tests and whenever AI is unavailable, so the report always exists. */
function plainWriting(f: ReportFacts): ReportWriting {
  return {
    headline: `${f.hoursSaved} verified hours saved in ${f.monthLabel}${f.wentLive.length ? `, with ${f.wentLive.length} new ${f.wentLive.length === 1 ? "tool" : "tools"} live` : ""}.`,
    story: `Teams saved ${f.hoursSaved} verified hours against ${f.hoursSavedLastMonth} the month before${f.hoursAwaitingVerification ? `, with ${f.hoursAwaitingVerification} more reported and awaiting verification` : ""}. ${f.ideasSubmitted} ideas were submitted and Champions resolved ${f.questionsResolved} questions.`,
    watch: [
      ...f.blocked.map((b) => `${b.title} has been blocked for ${b.days} days.`),
      ...f.waitingForApproval.map((w) => `${w.title} has waited ${w.days} days for approval.`),
      ...f.stalledBuilds.map((s) => `${s.title} has been quiet for ${s.quietDays} days.`),
    ].slice(0, 3),
    backNext: f.needPeople.slice(0, 3).map((n) => ({ title: n.title, why: `Needs ${n.spots} more ${n.spots === 1 ? "person" : "people"} to start building.` })),
  };
}

async function write(scope: Scope, f: ReportFacts): Promise<{ writing: ReportWriting; aiError: boolean }> {
  if (fixturesEnabled()) return { writing: plainWriting(f), aiError: false };
  try {
    const writing = await askClaudeForJson({
      scope,
      feature: "leadership_report",
      schema: writingSchema,
      maxTokens: 1500,
      system: `You write the monthly AI programme report for a company's leadership team. Use only the facts given; never invent numbers or names. Plain, confident English, no hype, no em dashes.
headline: one sentence with the single most important result. Hours saved are verified by someone outside the team; say "verified".
story: 2 to 4 sentences: what changed this month and why it matters to the business.${f.partial ? " The month is not over yet, so say 'so far'." : ""}
watch: up to 3 short risks leadership can act on (blocked work, approvals waiting, quiet builds), each naming the initiative.
backNext: up to 3 initiatives worth leadership's backing now, each with one sentence on why.
Never rank or compare individual people, and don't mention speed metrics.
JSON shape: {"headline":"","story":"","watch":["",""],"backNext":[{"title":"","why":""}]}`,
      prompt: JSON.stringify(f),
    });
    return { writing, aiError: false };
  } catch {
    return { writing: plainWriting(f), aiError: true };
  }
}

/** The saved report for a month, written first if needed (or on refresh). AI failure falls back to plain writing. */
export async function getReport(scope: Scope, key: string, { refresh = false } = {}): Promise<Report> {
  const { db } = scope;
  const saved = refresh ? null : await db.leadershipReport.findFirst({ where: { month: key } });
  const fresh = await gatherFacts(scope, key);
  if (saved) {
    const content = saved.content as { writing?: unknown; facts?: ReportFacts; aiError?: boolean };
    const parsed = writingSchema.safeParse(content?.writing);
    const keep = content?.facts && !content.aiError && (!fresh.partial || JSON.stringify({ ...content.facts, watchAsOf: "" }) === JSON.stringify({ ...fresh, watchAsOf: "" }));
    if (parsed.success && keep) return { facts: content.facts!, writing: parsed.data, generatedAt: saved.generatedAt };
  }
  const { writing, aiError } = await write(scope, fresh);
  const t = now();
  const content = { writing, facts: fresh, aiError } as unknown as Prisma.InputJsonValue;
  await db.leadershipReport.upsert({ where: { orgId_month: { orgId: scope.org.id, month: key } }, create: { orgId: scope.org.id, month: key, content, generatedAt: t }, update: { content, generatedAt: t } });
  return { facts: fresh, writing, generatedAt: t, aiError };
}

/** Scheduled job: early each month, write last month's report once and tell leadership. */
export async function publishLastMonthsReport(scope: Scope): Promise<boolean> {
  const last = monthKey(addMonths(startOfMonth(now()), -1));
  if (await scope.db.leadershipReport.findFirst({ where: { month: last } })) return false;
  const r = await getReport(scope, last);
  await notify(scope.db, await reportReaders(scope), { kind: "report", title: `Leadership report: ${r.facts.monthLabel}`, body: r.writing.headline, href: `/leadership/report?month=${last}` });
  return true;
}
