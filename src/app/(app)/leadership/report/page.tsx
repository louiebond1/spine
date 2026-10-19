import Link from "next/link";
import { notFound } from "next/navigation";
import { Sparkles } from "lucide-react";
import { Page } from "@/components/shell/Shell";
import { PageHeader } from "@/components/ui/PageHeader";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { ICON_STROKE } from "@/components/ui/icons";
import { ReportActions } from "@/features/report/ReportActions";
import { addMonths, startOfMonth } from "@/lib/tz";
import { now } from "@/server/clock";
import { can } from "@/server/permissions";
import { canSeeReport, getReport, monthKey, monthStart } from "@/server/report/report";
import { requireCtx } from "@/server/ctx";

const money = (n: number) => new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(n);

/** Monthly leadership report: counted facts, written up by Spine, printable as a PDF. */
export default async function ReportPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const ctx = await requireCtx();
  const user = ctx.user;
  if (!(await canSeeReport(ctx, user))) notFound();
  const { month: raw } = await searchParams;
  const current = monthKey(now());
  const fallback = monthKey(addMonths(startOfMonth(now()), -1));
  const month = raw && /^\d{4}-\d{2}$/.test(raw) && raw <= current ? raw : fallback;

  const report = await getReport(ctx, month);
  const { facts: f, writing: w } = report;
  const prev = monthKey(addMonths(monthStart(month), -1));
  const next = monthKey(addMonths(monthStart(month), 1));
  const delta = f.hoursSaved - f.hoursSavedLastMonth;

  const kpis: [string, string, string?][] = [
    ["Verified hours saved", String(f.hoursSaved), f.hoursAwaitingVerification ? `${f.hoursAwaitingVerification} more awaiting verification` : delta === 0 ? "Same as last month" : `${delta > 0 ? "+" : ""}${delta} on last month`],
    f.valueThisMonth != null ? ["Estimated value", money(f.valueThisMonth), f.valueToDate != null ? `${money(f.valueToDate)} to date` : undefined] : ["Hours to date", String(f.hoursSavedToDate)],
    ["Went Live", String(f.wentLive.length)],
    ["Ideas submitted", String(f.ideasSubmitted)],
    ["Questions resolved", String(f.questionsResolved), `${f.questionsAsked} asked`],
  ];

  return (
    <Page>
      <PageHeader back={{ href: "/leadership", label: "Leadership" }} eyebrow={`Monthly report${f.partial ? " · so far" : ""}`} title={f.monthLabel} aside={<ReportActions month={month} canRewrite={can.manage(user)} />} />

      <section className="rounded-container border border-border bg-surface p-4 sm:p-5">
        <p className="flex items-center gap-1.5 text-label font-medium text-text-muted">
          <Sparkles size={13} strokeWidth={ICON_STROKE} aria-hidden />
          {report.aiError ? "Summary (written without AI this time)" : "Summary"}
        </p>
        <h2 className="mt-3 text-section font-semibold text-text">{w.headline}</h2>
        <p className="mt-2 text-body text-text">{w.story}</p>
      </section>

      <section className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-container border border-border bg-border sm:grid-cols-3 lg:grid-cols-5">
        {kpis.map(([label, value, sub]) => (
          <div key={label} className="bg-surface px-4 py-3">
            <p className="text-label text-text-muted">{label}</p>
            <p className="mt-1 text-score font-semibold text-text">{value}</p>
            {sub && <p className="mt-1 text-label text-text-muted">{sub}</p>}
          </div>
        ))}
      </section>

      <div className="mt-4 grid gap-4 md:grid-cols-3">
        <section className="rounded-container border border-border bg-surface p-4">
          <SectionLabel>Went Live</SectionLabel>
          {f.wentLive.length === 0 ? (
            <p className="mt-3 text-meta text-text-muted">Nothing went Live this month.</p>
          ) : (
            <ul className="mt-3 space-y-3">
              {f.wentLive.map((x) => (
                <li key={x.title}>
                  <p className="text-meta font-medium text-text">{x.title}</p>
                  <p className="text-label text-text-muted">
                    {x.owner} · {x.topic} · for {x.forWhom}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="rounded-container border border-border bg-surface p-4">
          <SectionLabel>Worth watching (as of {f.watchAsOf})</SectionLabel>
          {w.watch.length === 0 ? (
            <p className="mt-3 text-meta text-text-muted">Nothing is stuck.</p>
          ) : (
            <ul className="mt-3 space-y-3">
              {w.watch.map((x) => (
                <li key={x} className="text-meta text-text">
                  {x}
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="rounded-container border border-border bg-surface p-4">
          <SectionLabel>Worth backing next</SectionLabel>
          {w.backNext.length === 0 ? (
            <p className="mt-3 text-meta text-text-muted">No suggestions this month.</p>
          ) : (
            <ul className="mt-3 space-y-3">
              {w.backNext.map((x) => (
                <li key={x.title}>
                  <p className="text-meta font-medium text-text">{x.title}</p>
                  <p className="text-label text-text-muted">{x.why}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 text-label text-text-muted print:hidden">
        <Link href={`/leadership/report?month=${prev}`} className="text-brand hover:text-brand-hover">
          Previous month
        </Link>
        <span>Numbers are counted by Spine. Hours count only when verified outside the team. The summary is written by AI from these numbers only.</span>
        {next <= current ? (
          <Link href={`/leadership/report?month=${next}`} className="text-brand hover:text-brand-hover">
            Next month
          </Link>
        ) : (
          <span />
        )}
      </div>
    </Page>
  );
}
