import Link from "next/link";
import { Page } from "@/components/shell/Shell";
import { PageHeader } from "@/components/ui/PageHeader";
import { Container } from "@/components/ui/Container";
import { Avatar } from "@/components/ui/Avatar";
import { MetaLine } from "@/components/ui/MetaLine";
import { EmptyState } from "@/components/ui/States";
import { ShareDiscovery } from "@/features/discover/ShareDiscovery";
import { Opportunities } from "@/features/discover/Opportunities";
import { shortDate } from "@/lib/format";
import { requireCtx } from "@/server/ctx";
import { can } from "@/server/permissions";

/** Inspiration: what colleagues tried with AI and what happened, plus patterns worth turning into initiatives. */
export default async function DiscoverPage({ searchParams }: { searchParams: Promise<{ share?: string }> }) {
  const ctx = await requireCtx();
  const { db, user } = ctx;
  const { share } = await searchParams;
  const [discoveries, topics, tools, answers] = await Promise.all([
    db.discovery.findMany({ orderBy: { at: "desc" }, take: 50, include: { author: { select: { name: true, initials: true } }, topic: { select: { name: true } }, project: { select: { id: true, title: true } } } }),
    db.topic.findMany({ where: { archivedAt: null }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.tool.findMany({ where: { status: { in: ["APPROVED", "LIMITED"] } }, orderBy: { position: "asc" }, select: { name: true } }),
    db.question.findMany({ where: { sharedAt: { not: null } }, orderBy: { sharedAt: "desc" }, take: 5, select: { id: true, title: true } }),
  ]);
  let opportunities: { id: string; title: string; problem: string; evidence: { id: string; title: string }[] }[] = [];
  if (can.seeQueue(user)) {
    const open = await db.opportunity.findMany({ where: { status: "OPEN" }, orderBy: { createdAt: "desc" }, take: 3 });
    // Evidence links only to questions the viewer may open: open queue items and shared answers.
    const evidence = await db.question.findMany({ where: { id: { in: open.flatMap((o) => o.evidenceIds) }, OR: [{ status: "UNCLAIMED" }, { sharedAt: { not: null } }, { askerId: user.id }, { claimerId: user.id }] }, select: { id: true, title: true } });
    opportunities = open.map((o) => ({ id: o.id, title: o.title, problem: o.problem, evidence: o.evidenceIds.map((id) => evidence.find((e) => e.id === id)).filter((e): e is { id: string; title: string } => !!e) }));
  }

  return (
    <Page>
      <PageHeader
        title="Discover"
        subtitle="What colleagues have tried with AI and what happened. Copy what works, and share your own."
        aside={share === "1" ? undefined : <ShareDiscovery open={false} topics={topics} tools={tools.map((t) => t.name)} />}
      />
      <div className="grid gap-6 lg:grid-cols-main-rail">
        <div className="min-w-0 space-y-4">
          {share === "1" && <ShareDiscovery open topics={topics} tools={tools.map((t) => t.name)} />}
          <Opportunities items={opportunities} />
          <Container heading="Discoveries" count={discoveries.length}>
            {discoveries.length === 0 ? (
              <EmptyState>No discoveries yet. Be the first to share something that saved you time.</EmptyState>
            ) : (
              discoveries.map((d) => (
                <details key={d.id} className="group py-3">
                  <summary className="flex cursor-pointer list-none gap-3">
                    <Avatar initials={d.author.initials} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-meta font-medium text-text">{d.title}</span>
                      <MetaLine size="label" parts={[d.author.name, d.toolName, d.topic?.name, shortDate(d.at)]} />
                      <span className="mt-1 line-clamp-2 block text-label text-text-muted group-open:hidden">{d.body}</span>
                    </span>
                  </summary>
                  <div className="mt-2 sm:pl-9">
                    <p className="max-w-prose whitespace-pre-line text-body text-text">{d.body}</p>
                    {d.project && (
                      <p className="mt-2 text-label text-text-muted">
                        From{" "}
                        <Link href={`/ideas/${d.project.id}`} className="text-brand hover:text-brand-hover">
                          {d.project.title}
                        </Link>
                      </p>
                    )}
                  </div>
                </details>
              ))
            )}
          </Container>
        </div>
        <aside>
          <Container heading="Recently shared answers" action={<Link href="/help-desk?tab=answers" className="text-label font-medium text-brand hover:text-brand-hover">All</Link>}>
            {answers.length === 0 ? (
              <EmptyState>None yet.</EmptyState>
            ) : (
              answers.map((a) => (
                <Link key={a.id} href={`/help-desk/${a.id}`} className="block py-2.5 text-meta text-text hover:text-brand">
                  {a.title}
                </Link>
              ))
            )}
          </Container>
        </aside>
      </div>
    </Page>
  );
}
