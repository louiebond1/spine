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
import { getCurrentUser } from "@/server/session";

const money = (n: number) => new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(n);

/** Monthly leadership report: counted facts, written up by Spine, printable as a PDF. */
export default async function ReportPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const user = await getCurrentUser();
  if (!(await canSeeReport(user))) notFound();
  const { month: raw } = await searchParams;
  const current = monthKey(now());
  const fallback = monthKey(addMonths(startOfMonth(now()), -1));
  const month = raw && /^\d{4}-\d{2}$/.test(raw) && raw <= current ? raw : fallback;

  let report;
  try {
    report = await getReport(month);
  } catch {
    return (
      <Page>
        <PageHeader title="Leadership report" />
        <p className="text-meta text-text-muted">The report couldn&apos;t be written just now. Try again.</p>
      </Page>
    );
  }
  const { facts: f, writing: w } = report;
  const prev = monthKey(addMonths(monthStart(month), -1));
  const next = monthKey(addMonths(monthStart(month), 1));
  const delta = f.hoursSaved - f.hoursSavedLastMonth;

  const kpis: [string, string, string?][] = [
    ["Hours saved", String(f.hoursSaved), delta === 0 ? "Same as last month" : `${delta > 0 ? "+" : ""}${delta} on last month`],
    f.valueThisMonth != null ? ["Estimated value", money(f.valueThisMonth), f.valueToDate != null ? `${money(f.valueToDate)} to date` : undefined] : ["Hours to date", String(f.hoursSavedToDate)],
    ["Went Live", String(f.wentLive.length)],
    ["Ideas submitted", String(f.ideasSubmitted)],
    ["Questions resolved", String(f.questionsResolved), `${f.questionsAsked} asked`],
  ];

  return (
    <Page>
      <div className="flex items-end justify-between gap-6">
        <PageHeader eyebrow={`Leadership report${f.partial ? " · so far" : ""}`} title={f.monthLabel} />
        <div className="mb-8">
          <ReportActions month={month} canRewrite={can.manage(user)} />
        </div>
      </div>

      <section className="rounded-container border border-border bg-surface px-6 py-6">
        <p className="flex items-center gap-2 text-label font-semibold text-brand">
          <Sparkles size={14} strokeWidth={ICON_STROKE} aria-hidden />
          Spine&apos;s summary
        </p>
        <h2 className="mt-3 text-section font-semibold text-text">{w.headline}</h2>
        <p className="mt-2 text-body text-text">{w.story}</p>
      </section>

      <section className="mt-5 grid grid-cols-5 divide-x divide-border rounded-container border border-border bg-surface">
        {kpis.map(([label, value, sub]) => (
          <div key={label} className="px-6 py-5">
            <p className="text-label text-text-muted">{label}</p>
            <p className="mt-1 text-score font-semibold text-text">{value}</p>
            {sub && <p className="mt-1 text-label text-text-muted">{sub}</p>}
          </div>
        ))}
      </section>

      <div className="mt-5 grid grid-cols-3 gap-5">
        <section className="rounded-container border border-border bg-surface px-6 py-5">
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
        <section className="rounded-container border border-border bg-surface px-6 py-5">
          <SectionLabel>Worth watching</SectionLabel>
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
        <section className="rounded-container border border-border bg-surface px-6 py-5">
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

      <div className="mt-6 flex items-center justify-between text-label text-text-muted print:hidden">
        <Link href={`/programme/report?month=${prev}`} className="text-brand hover:text-brand-hover">
          Previous month
        </Link>
        <span>Facts are counted by Spine; the words are written by Claude from those facts only.</span>
        {next <= current ? (
          <Link href={`/programme/report?month=${next}`} className="text-brand hover:text-brand-hover">
            Next month
          </Link>
        ) : (
          <span />
        )}
      </div>
    </Page>
  );
}
