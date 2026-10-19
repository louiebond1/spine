import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { Page } from "@/components/shell/Shell";
import { PageHeader } from "@/components/ui/PageHeader";
import { Container } from "@/components/ui/Container";
import { EmptyState } from "@/components/ui/States";
import { ICON_STROKE } from "@/components/ui/icons";
import { PlaybookItemEditor } from "@/features/playbook/PlaybookEditor";
import { cx } from "@/lib/cx";
import { shortDate } from "@/lib/format";
import { requireCtx } from "@/server/ctx";
import { can } from "@/server/permissions";

const STATUS = {
  APPROVED: { label: "Approved", cls: "bg-positive-soft text-positive" },
  LIMITED: { label: "Approved with limits", cls: "bg-warning-soft text-warning" },
  NOT_APPROVED: { label: "Not approved", cls: "bg-critical-soft text-critical" },
} as const;

/** Alignment: what the company is prioritising, which AI tools are approved for what data, and how to use them. */
export default async function PlaybookPage() {
  const ctx = await requireCtx();
  const edit = can.editPlaybook(ctx.user);
  const [priorities, tools, guides] = await Promise.all([
    ctx.db.priority.findMany({ where: edit ? {} : { active: true }, orderBy: { position: "asc" } }),
    ctx.db.tool.findMany({ orderBy: [{ status: "asc" }, { position: "asc" }] }),
    ctx.db.guide.findMany({ orderBy: { position: "asc" } }),
  ]);
  return (
    <Page>
      <PageHeader
        title="Playbook"
        subtitle={`How ${ctx.org.name} uses AI: what we're prioritising, which tools are approved for which data, and the guidance to follow. Spine's AI answers and reviews follow it too.`}
      />
      <div className="space-y-6">
        <Container heading="Priorities" description="Where AI effort should go first." action={edit ? <PlaybookItemEditor kind="priority" label="Add priority" /> : undefined}>
          {priorities.length === 0 ? (
            <EmptyState>{edit ? "Add the two or three outcomes AI should help with first." : "No priorities published yet."}</EmptyState>
          ) : (
            priorities.map((p, i) => (
              <div key={p.id} className="flex gap-3 py-3">
                <span className="w-5 shrink-0 text-label font-semibold text-text-faint">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-meta font-medium text-text">
                    {p.title}
                    {!p.active && <span className="ml-2 text-label font-normal text-text-faint">Hidden</span>}
                  </p>
                  <p className="text-meta text-text-muted">{p.description}</p>
                  {edit && <PlaybookItemEditor kind="priority" id={p.id} label={p.title} initial={{ title: p.title, description: p.description, active: p.active }} />}
                </div>
              </div>
            ))
          )}
        </Container>

        <Container heading="AI tools" description="What's approved, and what data can go in each." action={edit ? <PlaybookItemEditor kind="tool" label="Add tool" /> : undefined}>
          {tools.length === 0 ? (
            <EmptyState>{edit ? "List the AI tools people may use, and the data rules for each." : "No tools listed yet. Ask the Help Desk before using a new AI tool with company data."}</EmptyState>
          ) : (
            tools.map((t) => (
              <div key={t.id} id={`tool-${t.id}`} className="py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-meta font-medium text-text">{t.name}</p>
                  <span className={cx("rounded-full px-2 py-0.5 text-tiny font-medium", STATUS[t.status].cls)}>{STATUS[t.status].label}</span>
                  {t.url && (
                    <a href={t.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-label text-text-muted hover:text-text">
                      Open <ExternalLink size={12} strokeWidth={ICON_STROKE} aria-hidden />
                    </a>
                  )}
                </div>
                <p className="mt-0.5 text-meta text-text-muted">{t.purpose}</p>
                <p className="mt-1 text-label text-text">
                  <span className="font-medium">Data: </span>
                  {t.dataGuidance}
                </p>
                {edit && <PlaybookItemEditor kind="tool" id={t.id} label={t.name} initial={{ name: t.name, purpose: t.purpose, status: t.status, dataGuidance: t.dataGuidance, url: t.url ?? "" }} />}
              </div>
            ))
          )}
        </Container>

        <Container heading="Guidance" description="Policies and how-tos, in plain words." action={edit ? <PlaybookItemEditor kind="guide" label="Add guidance" /> : undefined}>
          {guides.length === 0 ? (
            <EmptyState>{edit ? "Add your AI policy and the how-tos people ask about most." : "No guidance published yet."}</EmptyState>
          ) : (
            guides.map((g) => (
              <details key={g.id} id={`guide-${g.id}`} className="group py-3">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
                  <span className="text-meta font-medium text-text">{g.title}</span>
                  <span className="text-label text-text-faint">Updated {shortDate(g.updatedAt)}</span>
                </summary>
                <p className="mt-2 max-w-prose whitespace-pre-line text-body text-text">{g.body}</p>
                {edit && <PlaybookItemEditor kind="guide" id={g.id} label={g.title} initial={{ title: g.title, body: g.body }} />}
              </details>
            ))
          )}
        </Container>
        <p className="text-label text-text-muted">
          Something missing or unclear?{" "}
          <Link href="?ask=1" className="font-medium text-brand hover:text-brand-hover">
            Ask the Help Desk
          </Link>
          .
        </p>
      </div>
    </Page>
  );
}
