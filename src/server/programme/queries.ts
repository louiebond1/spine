import "server-only";
import type { Range } from "@/lib/periods";
import { addMonths, startOfMonth } from "@/lib/tz";
import { now } from "../clock";
import { db } from "../db";
import { getSettings } from "../settings";

// CLAUDE.md section 7, Programme. Never reads AI scores, speed metrics or rankings of people.

const DAY = 86_400_000;

export async function recentWins(range: Range) {
  return db.project.findMany({
    where: { stage: "LIVE", liveAt: { gte: range.from, lte: range.to } },
    orderBy: { liveAt: "asc" },
    select: { id: true, title: true, liveAt: true, owner: { select: { name: true } }, topic: { select: { name: true } } },
  });
}

export async function bigFlags() {
  const t = now();
  const settings = await getSettings();
  const [waiting, stalled] = await Promise.all([
    db.project.findMany({
      // Waiting since submission (App) or since the build finished (Cowork-native).
      where: {
        stage: "APPROVAL",
        OR: [
          { buildCompletedAt: null, submittedAt: { lt: new Date(t.getTime() - 3 * DAY) } },
          { buildCompletedAt: { lt: new Date(t.getTime() - 3 * DAY) } },
        ],
      },
      orderBy: { submittedAt: "asc" },
      select: { id: true, title: true, submittedAt: true, autoApproveAt: true, buildCompletedAt: true, owner: { select: { name: true } } },
    }),
    db.project.findMany({
      where: { stage: "BUILDING", lastActivityAt: { lt: new Date(t.getTime() - settings.stalledBuildDays * DAY) } },
      orderBy: { lastActivityAt: "asc" },
      select: { id: true, title: true, lastActivityAt: true, owner: { select: { name: true } } },
    }),
  ]);
  return { waiting, stalled };
}

export type ValuePoint = { month: Date; hours: number; byProject: { title: string; hours: number }[] };

/** Hours saved per month, from the month the period starts to the current month. */
export async function valueSeries(range: Range): Promise<ValuePoint[]> {
  const first = startOfMonth(range.from);
  const last = startOfMonth(range.to);
  const logs = await db.impactLog.findMany({
    where: { month: { gte: first, lte: last } },
    include: { project: { select: { title: true } } },
    orderBy: { project: { title: "asc" } },
  });
  const points: ValuePoint[] = [];
  for (let m = first; m.getTime() <= last.getTime(); m = addMonths(m, 1)) {
    const month = logs.filter((l) => l.month.getTime() === m.getTime());
    points.push({
      month: m,
      hours: month.reduce((s, l) => s + l.hoursSaved, 0),
      byProject: month.filter((l) => l.hoursSaved > 0).map((l) => ({ title: l.project.title, hours: l.hoursSaved })),
    });
  }
  return points;
}
