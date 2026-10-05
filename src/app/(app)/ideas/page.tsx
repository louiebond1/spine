import Link from "next/link";
import { Page } from "@/components/shell/Shell";
import { PageHeader } from "@/components/ui/PageHeader";
import { SegmentedToggle } from "@/components/ui/SegmentedToggle";
import { PipelineBoard } from "@/features/ideas/PipelineBoard";
import { ProjectList } from "@/features/ideas/ProjectList";
import { now } from "@/server/clock";
import { db } from "@/server/db";
import { runDueAutoApprovals } from "@/server/projects/autoApprove";
import { listProjects } from "@/server/projects/queries";
import { getCurrentUser } from "@/server/session";

type Params = { view?: string; owner?: string; person?: string; sort?: string };

/** Ideas & Projects (07): Pipeline or List, optionally filtered to one person's work. */
export default async function IdeasPage({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const user = await getCurrentUser();
  await runDueAutoApprovals();

  const view = params.view === "list" ? "list" : "pipeline";
  const personId = params.owner === "me" ? user.id : params.person;
  const person = personId && personId !== user.id ? await db.user.findUnique({ where: { id: personId } }) : null;
  const projects = await listProjects(user, { personId: personId && (personId === user.id || person) ? personId : undefined });

  const keep = (extra: Record<string, string | undefined>) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries({ owner: params.owner, person: params.person, ...extra })) if (v) q.set(k, v);
    return `/ideas?${q.toString()}`;
  };
  const sort = params.sort === "stage" || params.sort === "stage-desc" ? params.sort : null;
  const filtered = Boolean(params.owner === "me" || person);

  return (
    <Page>
      <PageHeader title="Ideas & Projects" />
      <div className="-mt-3 mb-3 flex items-center gap-6">
        <SegmentedToggle
          active={view}
          options={[
            { key: "pipeline", label: "Pipeline", href: keep({ view: undefined }) },
            { key: "list", label: "List", href: keep({ view: "list" }) },
          ]}
        />
        {filtered && (
          <span className="text-meta text-text-muted">
            {person ? `${person.name}’s projects` : "Your projects"} ·{" "}
            <Link href={view === "list" ? "/ideas?view=list" : "/ideas"} className="text-brand hover:text-brand-hover">
              Show all
            </Link>
          </span>
        )}
      </div>
      <p className="mb-6 text-meta text-text-muted">Approval: App ideas before recruiting · Cowork-native after building</p>
      {view === "pipeline" ? (
        <PipelineBoard projects={projects} viewerId={user.id} now={now()} />
      ) : (
        <ProjectList
          projects={projects}
          sort={sort}
          sortHref={keep({ view: "list", sort: sort === "stage" ? "stage-desc" : sort === "stage-desc" ? undefined : "stage" })}
        />
      )}
    </Page>
  );
}
