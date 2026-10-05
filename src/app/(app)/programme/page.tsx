import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Page } from "@/components/shell/Shell";
import { PageHeader } from "@/components/ui/PageHeader";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { LiveDot } from "@/components/ui/LiveDot";
import { MetaLine } from "@/components/ui/MetaLine";
import { PeriodSelect } from "@/components/ui/PeriodSelect";
import { SegmentedToggle } from "@/components/ui/SegmentedToggle";
import { EmptyState } from "@/components/ui/States";
import { ValueChart } from "@/features/programme/ValueChart";
import { daysBetween, dayMonth, monthName, pageDate, plural } from "@/lib/format";
import { PROGRAMME_PERIODS, programmeRange, type ProgrammePeriod } from "@/lib/periods";
import { now } from "@/server/clock";
import { can } from "@/server/permissions";
import { bigFlags, recentWins, valueSeries } from "@/server/programme/queries";
import { getSettings } from "@/server/settings";
import { getCurrentUser } from "@/server/session";

const HOUR = 3_600_000;

function Section({ label, children, action }: { label: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="rounded-container border border-border bg-surface px-6 pb-5 pt-6">
      <div className="mb-3 flex items-center justify-between">
        <SectionLabel>{label}</SectionLabel>
        {action}
      </div>
      {children}
    </section>
  );
}

/** Programme (10). Admins only. */
export default async function ProgrammePage({ searchParams }: { searchParams: Promise<{ period?: string; mode?: string }> }) {
  const user = await getCurrentUser();
  if (!can.manage(user)) notFound();
  const { period: raw, mode: rawMode } = await searchParams;
  const period: ProgrammePeriod = PROGRAMME_PERIODS.some((p) => p.value === raw) ? (raw as ProgrammePeriod) : "90d";
  const mode = rawMode === "value" ? "value" : "hours";
  const t = now();
  const range = programmeRange(period, t);
  const [wins, flags, series, settings] = await Promise.all([recentWins(range), bigFlags(), valueSeries(range), getSettings()]);

  const hourlyCost = settings.hourlyCost ? Number(settings.hourlyCost) : null;
  const money = (n: number) => new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(n);
  const showValue = mode === "value";
  const format = showValue ? (n: number) => money(n) : (n: number) => String(n);
  const toValue = (hours: number) => (showValue && hourlyCost ? hours * hourlyCost : hours);
  const latest = series[series.length - 1];
  const modeHref = (m: string) => `/programme?period=${period}${m === "value" ? "&mode=value" : ""}`;

  return (
    <Page>
      <PageHeader
        date={pageDate(t)}
        title="Programme"
        aside={
          <Suspense>
            <PeriodSelect value={period} options={PROGRAMME_PERIODS} />
          </Suspense>
        }
      />
      <div className="space-y-5">
        <Section label="Recent wins">
          {wins.length === 0 ? (
            <EmptyState className="py-3">Nothing went Live in this period.</EmptyState>
          ) : (
            <div className="divide-y divide-border">
              {wins.map((w) => (
                <div key={w.id} className="flex items-start gap-5 py-3">
                  <span className="mt-2">
                    <LiveDot />
                  </span>
                  <div>
                    <Link href={`/ideas/${w.id}`} className="text-row-title font-medium text-text hover:text-brand">
                      {w.title}
                    </Link>
                    <MetaLine parts={[w.owner.name, w.topic.name, `Went live ${dayMonth(w.liveAt!)}`]} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Section>

        <Section label="Big flags">
          <div className="grid grid-cols-2 divide-x divide-border">
            <div className="pr-8">
              <p className="mb-2 text-label font-medium text-text-muted">Waiting on approval</p>
              {flags.waiting.length === 0 && <p className="text-meta text-text-muted">Nothing has waited more than 3 days.</p>}
              {flags.waiting.map((p) => {
                const hours = p.autoApproveAt ? Math.ceil((p.autoApproveAt.getTime() - t.getTime()) / HOUR) : null;
                return (
                  <div key={p.id} className="mb-2">
                    <Link href={`/ideas/${p.id}/approve`} className="text-row-title font-medium text-text hover:text-brand">
                      {p.title}
                    </Link>
                    <MetaLine
                      parts={[
                        p.owner.name,
                        `Waiting ${plural(daysBetween(p.buildCompletedAt ?? p.submittedAt!, t), "day")}`,
                        hours !== null && (hours < 24 ? `Auto-approves in ${plural(hours, "hour")}` : `Auto-approves in ${plural(Math.ceil(hours / 24), "day")}`),
                      ]}
                    />
                  </div>
                );
              })}
            </div>
            <div className="pl-8">
              <p className="mb-2 text-label font-medium text-text-muted">Stalled builds</p>
              {flags.stalled.length === 0 && <p className="text-meta text-text-muted">No builds have gone quiet.</p>}
              {flags.stalled.map((p) => (
                <div key={p.id} className="mb-2">
                  <Link href={`/ideas/${p.id}`} className="text-row-title font-medium text-text hover:text-brand">
                    {p.title}
                  </Link>
                  <MetaLine parts={[p.owner.name, `No activity for ${plural(Math.floor((t.getTime() - p.lastActivityAt.getTime()) / 86_400_000), "day")}`]} />
                </div>
              ))}
            </div>
          </div>
        </Section>

        <Section
          label="Value over time"
          action={
            <SegmentedToggle
              size="sm"
              active={mode}
              options={[
                { key: "hours", label: "Hours saved", href: modeHref("hours") },
                { key: "value", label: "Estimated value", href: modeHref("value") },
              ]}
            />
          }
        >
          {showValue && !hourlyCost ? (
            <EmptyState className="py-10">Add an hourly cost in Admin &gt; Impact assumptions to see estimated value</EmptyState>
          ) : (
            <>
              <ValueChart points={series.map((s) => ({ label: monthName(s.month), value: toValue(s.hours) }))} format={format} />
              {latest && (
                <p className="mt-3 text-meta text-text-muted">
                  {monthName(latest.month)}: {showValue ? money(toValue(latest.hours)) : plural(latest.hours, "hour")}
                  {latest.byProject.length > 0 &&
                    ` (${latest.byProject.map((b) => `${b.title} ${showValue ? money(toValue(b.hours)) : b.hours}`).join(" · ")})`}
                </p>
              )}
            </>
          )}
        </Section>
      </div>
    </Page>
  );
}
