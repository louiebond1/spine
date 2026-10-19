import Link from "next/link";
import { Page } from "@/components/shell/Shell";
import { PageHeader } from "@/components/ui/PageHeader";
import { SegmentedToggle } from "@/components/ui/SegmentedToggle";
import { Button } from "@/components/ui/Button";
import { PipelineBoard } from "@/features/ideas/PipelineBoard";
import { ProjectList } from "@/features/ideas/ProjectList";
import { now } from "@/server/clock";
import { requireCtx } from "@/server/ctx";
import { listProjects } from "@/server/projects/queries";

type Params = { view?: string; person?: string; sort?: string };

/** Initiatives: every submitted idea and initiative, as a board or a list, optionally one person's. */
export default async function InitiativesPage({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const ctx = await requireCtx();
  const view = params.view === "list" ? "list" : "pipeline";
  const personId = params.person === "me" ? ctx.user.id : params.person;
  const person = personId && personId !== ctx.user.id ? await ctx.db.user.findUnique({ where: { id: personId } }) : null;
  const projects = await listProjects(ctx, { personId: personId && (personId === ctx.user.id || person) ? personId : undefined });
  const keep = (extra: Record<string, string | undefined>) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries({ person: params.person, ...extra })) if (v) q.set(k, v);
    return `/ideas?${q.toString()}`;
  };
  const sort = params.sort === "stage" || params.sort === "stage-desc" ? params.sort : null;
  const filtered = Boolean(params.person === "me" || person);

  return (
    <Page>
      <PageHeader
        title="Initiatives"
        subtitle="Every AI initiative from idea to live: who owns it, what stage it's at and what happens next."
        aside={<Button variant="primary" href="/ideas/new">Propose an idea</Button>}
      />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SegmentedToggle
          active={view}
          options={[
            { key: "pipeline", label: "Board", href: keep({ view: undefined }) },
            { key: "list", label: "List", href: keep({ view: "list" }) },
          ]}
        />
        {filtered ? (
          <span className="text-label text-text-muted">
            {person ? `${person.name}'s initiatives` : "Your initiatives"} ·{" "}
            <Link href={view === "list" ? "/ideas?view=list" : "/ideas"} className="font-medium text-brand hover:text-brand-hover">
              Show all
            </Link>
          </span>
        ) : (
          <Link href={keep({ view: view === "list" ? "list" : undefined, person: "me" })} className="text-label text-text-muted hover:text-text">
            Only mine
          </Link>
        )}
      </div>
      {view === "pipeline" ? (
        <PipelineBoard projects={projects.filter((p) => p.stage !== "IDEA")} viewerId={ctx.user.id} now={now()} />
      ) : (
        <ProjectList projects={projects} sort={sort} sortHref={keep({ view: "list", sort: sort === "stage" ? "stage-desc" : sort === "stage-desc" ? undefined : "stage" })} />
      )}
    </Page>
  );
}
