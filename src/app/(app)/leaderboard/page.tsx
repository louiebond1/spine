import { Suspense } from "react";
import { Page } from "@/components/shell/Shell";
import { PageHeader } from "@/components/ui/PageHeader";
import { Avatar } from "@/components/ui/Avatar";
import { PeriodSelect } from "@/components/ui/PeriodSelect";
import { EmptyState } from "@/components/ui/States";
import { cx } from "@/lib/cx";
import { pageDate } from "@/lib/format";
import { LEADERBOARD_PERIODS, leaderboardRange, type LeaderboardPeriod } from "@/lib/periods";
import { now } from "@/server/clock";
import { getLeaderboard } from "@/server/leaderboard/points";
import { getCurrentUser } from "@/server/session";

/** Leaderboard (11): Champions ranked by questions resolved in the period. */
export default async function LeaderboardPage({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  const { period: raw } = await searchParams;
  const period: LeaderboardPeriod = LEADERBOARD_PERIODS.some((p) => p.value === raw) ? (raw as LeaderboardPeriod) : "this-month";
  const user = await getCurrentUser();
  const t = now();
  const rows = await getLeaderboard(leaderboardRange(period, t), user.id);

  return (
    <Page width="narrow">
      <PageHeader
        date={pageDate(t)}
        title="Leaderboard"
        aside={
          <Suspense>
            <PeriodSelect value={period} options={LEADERBOARD_PERIODS} />
          </Suspense>
        }
      />
      <section className="rounded-container border border-border bg-surface px-3">
        <div className="flex justify-end border-b border-border px-6 py-4">
          <span className="w-36 text-center text-label font-medium text-text-muted">Questions resolved</span>
        </div>
        {rows.length === 0 ? (
          <EmptyState className="px-6">No Champions yet.</EmptyState>
        ) : (
          <ol className="divide-y divide-border">
            {rows.map((r) => (
              <li key={r.id} className={cx("flex items-center gap-8 px-6 py-4", r.isViewer && "rounded-control bg-brand-soft/50")}>
                <span className="w-6 text-meta text-text-muted">{r.rank}</span>
                <Avatar initials={r.initials} />
                <span className="flex flex-1 items-center gap-3 text-meta text-text">
                  {r.name}
                  {r.isViewer && <span className="rounded-sm bg-brand-soft px-2 text-label font-medium text-brand">You</span>}
                </span>
                <span className="w-36 text-center text-meta text-text">{r.points}</span>
              </li>
            ))}
          </ol>
        )}
      </section>
    </Page>
  );
}
