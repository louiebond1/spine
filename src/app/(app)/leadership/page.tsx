import Link from "next/link";
import { notFound } from "next/navigation";
import { Page } from "@/components/shell/Shell";
import { PageHeader } from "@/components/ui/PageHeader";
import { Container } from "@/components/ui/Container";
import { LiveDot } from "@/components/ui/LiveDot";
import { MetaLine } from "@/components/ui/MetaLine";
import { PeriodSelect } from "@/components/ui/PeriodSelect";
import { EmptyState } from "@/components/ui/States";
import { Button } from "@/components/ui/Button";
import { ValueChart } from "@/features/programme/ValueChart";
import { dayMonth, monthName } from "@/lib/format";
import { PROGRAMME_PERIODS, programmeRange, type ProgrammePeriod } from "@/lib/periods";
import { now } from "@/server/clock";
import { requireCtx } from "@/server/ctx";
import { getAllPulseHits } from "@/server/pulse/pulse";
import { adoptionSnapshot, recentWins, valueSeries } from "@/server/programme/queries";
import { canSeeReport } from "@/server/report/report";
import { getSettings } from "@/server/settings";
import { STAGE_LABEL } from "@/server/projects/lifecycle";

const money = (n: number) => new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(n);

/** Leadership: verified outcomes, adoption and what needs backing. No AI scores, speed metrics or rankings of people. */
export default async function LeadershipPage({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  const ctx = await requireCtx();
  if (!(await canSeeReport(ctx, ctx.user))) notFound();
  const { period: raw } = await searchParams;
  const period: ProgrammePeriod = PROGRAMME_PERIODS.some((p) => p.value === raw) ? (raw as ProgrammePeriod) : "90d";
  const t = now();
  const range = programmeRange(period, t);
  const [wins, series, settings, adoption, hits] = await Promise.all([recentWins(ctx, range), valueSeries(ctx, range), getSettings(ctx), adoptionSnapshot(ctx, range.from), getAllPulseHits(ctx)]);
  const verified = series.reduce((s, p) => s + p.verified, 0);
  const pending = series.reduce((s, p) => s + p.reported, 0);
  const hourly = settings.hourlyCost ? Number(settings.hourlyCost) : null;
  const watch = hits.filter((h) => ["blocked", "approval", "build"].includes(h.check)).slice(0, 6);
  const kpis: [string, string, string?][] = [
    ["Verified hours saved", String(verified), pending ? `${pending} more awaiting verification` : undefined],
    hourly ? ["Estimated value", money(verified * hourly), `at ${money(hourly)} an hour`] : ["Live initiatives", String(adoption.stages.LIVE ?? 0)],
    ["In flight", String((adoption.stages.APPROVAL ?? 0) + (adoption.stages.RECRUITING ?? 0) + (adoption.stages.BUILDING ?? 0) + (adoption.stages.PUBLISHING ?? 0)), `${adoption.stages.BUILDING ?? 0} building`],
    ["People active", `${adoption.active} of ${adoption.people}`, "signed in this period"],
    ["Questions asked", String(adoption.asked), `${adoption.shared} answers shared in total`],
  ];
  return (
    <Page>
      <PageHeader
        title="Leadership"
        subtitle="What AI is delivering, what's in flight and where to step in. Hours count only once someone outside the team has verified them."
        aside={
          <>
            <PeriodSelect value={period} options={PROGRAMME_PERIODS} />
            <Button href="/leadership/report">Monthly report</Button>
          </>
        }
      />
      <section className="mb-4 grid grid-cols-2 gap-px overflow-hidden rounded-container border border-border bg-border sm:grid-cols-3 lg:grid-cols-5">
        {kpis.map(([label, value, sub]) => (
          <div key={label} className="bg-surface px-4 py-3">
            <p className="text-label text-text-muted">{label}</p>
            <p className="mt-0.5 text-score font-semibold text-text">{value}</p>
            {sub && <p className="text-tiny text-text-muted">{sub}</p>}
          </div>
        ))}
      </section>
      <div className="grid gap-4 lg:grid-cols-main-rail">
        <div className="min-w-0 space-y-4">
          <Container heading="Verified hours saved" description={pending ? "Dashed line includes hours awaiting verification." : undefined} variant="plain">
            {series.some((p) => p.verified || p.reported) ? (
              <ValueChart points={series.map((p) => ({ label: monthName(p.month).slice(0, 3), value: p.verified, pending: p.reported }))} format={(n) => String(n)} />
            ) : (
              <EmptyState className="py-2">No outcomes reported in this period yet.</EmptyState>
            )}
          </Container>
          <Container heading="Went live" count={wins.length}>
            {wins.length === 0 ? (
              <EmptyState>Nothing went live in this period.</EmptyState>
            ) : (
              wins.map((w) => (
                <Link key={w.id} href={`/ideas/${w.id}`} className="flex items-center gap-3 py-3 hover:opacity-80">
                  <LiveDot />
                  <span className="min-w-0 flex-1">
                    <span className="block text-meta font-medium text-text">{w.title}</span>
                    <MetaLine size="label" parts={[w.owner.name, w.topic.name, `for ${w.whoBenefits}`]} />
                  </span>
                  <span className="text-label text-text-muted">{w.liveAt ? dayMonth(w.liveAt) : ""}</span>
                </Link>
              ))
            )}
          </Container>
        </div>
        <aside className="space-y-4">
          <Container heading="Needs leadership" description="Blocked, waiting on a decision, or gone quiet.">
            {watch.length === 0 ? (
              <EmptyState>Nothing is stuck.</EmptyState>
            ) : (
              watch.map((h) => (
                <Link key={h.key} href={h.action.href} className="block py-2.5 hover:opacity-80">
                  <span className="block text-meta font-medium text-text">{h.title}</span>
                  <span className="block text-label text-text-muted">{h.reason}</span>
                </Link>
              ))
            )}
          </Container>
          <Container heading="Pipeline" variant="plain">
            <dl className="space-y-1.5">
              {(["APPROVAL", "RECRUITING", "BUILDING", "PUBLISHING", "LIVE"] as const).map((s) => (
                <div key={s} className="flex justify-between text-meta">
                  <dt className="text-text-muted">{STAGE_LABEL[s]}</dt>
                  <dd className="font-medium text-text">{adoption.stages[s] ?? 0}</dd>
                </div>
              ))}
            </dl>
          </Container>
        </aside>
      </div>
    </Page>
  );
}
