import "server-only";
import type { Range } from "@/lib/periods";
import { addMonths, startOfMonth } from "@/lib/tz";
import type { Scope } from "../ctx";

// Leadership view. Counts verified outcomes; never reads AI scores, speed metrics or rankings of people.

export async function recentWins(scope: Scope, range: Range) {
  return scope.db.project.findMany({
    where: { stage: "LIVE", liveAt: { gte: range.from, lte: range.to } },
    orderBy: { liveAt: "desc" },
    select: { id: true, title: true, liveAt: true, whoBenefits: true, owner: { select: { name: true } }, topic: { select: { name: true } } },
  });
}

export type ValuePoint = { month: Date; verified: number; reported: number };

/** Verified and reported-but-unverified hours per month across the range. */
export async function valueSeries(scope: Scope, range: Range): Promise<ValuePoint[]> {
  const first = startOfMonth(range.from);
  const last = startOfMonth(range.to);
  const logs = await scope.db.impactLog.findMany({ where: { project: { orgId: scope.org.id }, month: { gte: first, lte: last } }, select: { month: true, hoursSaved: true, verifiedAt: true } });
  const points: ValuePoint[] = [];
  for (let m = first; m.getTime() <= last.getTime(); m = addMonths(m, 1)) {
    const month = logs.filter((l) => l.month.getTime() === m.getTime());
    points.push({
      month: m,
      verified: month.filter((l) => l.verifiedAt).reduce((s, l) => s + l.hoursSaved, 0),
      reported: month.filter((l) => !l.verifiedAt).reduce((s, l) => s + l.hoursSaved, 0),
    });
  }
  return points;
}

/** Adoption at a glance: what the programme looks like right now. */
export async function adoptionSnapshot(scope: Scope, since: Date) {
  const { db } = scope;
  const [people, active, asked, shared, discoveries, stages] = await Promise.all([
    db.user.count({ where: { status: "ACTIVE" } }),
    db.user.count({ where: { status: "ACTIVE", lastLoginAt: { gte: since } } }),
    db.question.count({ where: { postedAt: { gte: since } } }),
    db.question.count({ where: { sharedAt: { not: null } } }),
    db.discovery.count({ where: { at: { gte: since } } }),
    db.project.groupBy({ by: ["stage"], _count: true, where: { stage: { not: "IDEA" } } }),
  ]);
  return { people, active, asked, shared, discoveries, stages: Object.fromEntries(stages.map((s) => [s.stage, s._count])) as Record<string, number> };
}
