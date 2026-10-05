import "server-only";
import type { Range } from "@/lib/periods";
import { db } from "../db";

// CLAUDE.md section 6 and 7: points are not stored. A Champion's points for a period are the
// number of questions they claimed that were resolved in that period.

export type LeaderboardRow = { id: string; name: string; initials: string; points: number; rank: number; isViewer: boolean };

export async function getLeaderboard(range: Range, viewerId: string): Promise<LeaderboardRow[]> {
  const [champions, counts] = await Promise.all([
    db.user.findMany({ where: { isChampion: true }, select: { id: true, name: true, initials: true } }),
    db.question.groupBy({
      by: ["claimerId"],
      where: { status: "RESOLVED", claimerId: { not: null }, resolvedAt: { gte: range.from, lt: range.to } },
      _count: { _all: true },
    }),
  ]);
  const points = new Map(counts.map((c) => [c.claimerId, c._count._all]));

  // Highest first; 0-point champions come after everyone else. Names break display ties only.
  const sorted = champions
    .map((c) => ({ ...c, points: points.get(c.id) ?? 0 }))
    .sort((a, b) => b.points - a.points || a.name.localeCompare(b.name));

  // Standard competition ranking: ties share a rank (1, 2, 2, 4).
  return sorted.map((c, i) => {
    const firstWithSamePoints = sorted.findIndex((x) => x.points === c.points);
    return { ...c, rank: firstWithSamePoints === i ? i + 1 : firstWithSamePoints + 1, isViewer: c.id === viewerId };
  });
}
