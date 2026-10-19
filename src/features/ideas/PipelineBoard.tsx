import Link from "next/link";
import type { ProjectStage } from "@prisma/client";
import { LiveDot } from "@/components/ui/LiveDot";
import { MetaLine } from "@/components/ui/MetaLine";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { StatusPill } from "@/components/ui/StatusPill";
import { firstName, plural } from "@/lib/format";
import { startOfDay } from "@/lib/tz";
import { STAGE_LABEL } from "@/server/projects/lifecycle";
import type { ProjectSummary } from "@/server/projects/queries";

const COLUMNS: ProjectStage[] = ["APPROVAL", "RECRUITING", "BUILDING", "PUBLISHING", "LIVE"];
const HOUR = 3_600_000;
const DAY = 24 * HOUR;

function CardStatus({ p, viewerId, now }: { p: ProjectSummary; viewerId: string; now: Date }) {
  switch (p.stage) {
    case "APPROVAL": {
      if (p.autoApproveAt && p.autoApproveAt.getTime() - now.getTime() < DAY) {
        return <p className="text-tiny text-text">Auto-approves in {plural(Math.max(1, Math.ceil((p.autoApproveAt.getTime() - now.getTime()) / HOUR)), "hour")}</p>;
      }
      const days = p.submittedAt ? Math.round((startOfDay(now).getTime() - startOfDay(p.submittedAt).getTime()) / DAY) : 0;
      return <p className="text-tiny text-text-muted">{days === 0 ? "Submitted today" : `Waiting ${plural(days, "day")}`}</p>;
    }
    case "RECRUITING":
      return (
        <>
          <ProgressBar value={p.team.length} max={p.teamSize} />
          <p className="mt-1.5 text-tiny text-text-muted">
            {p.team.length} of {p.teamSize} people
          </p>
        </>
      );
    case "BUILDING":
      return (
        <>
          <ProgressBar value={p.stepsDone} max={p.steps.length} />
          <p className="mt-1.5 text-tiny text-text-muted">{p.steps.length ? `${p.stepsDone} of ${p.steps.length} steps` : "Drafting the plan"}</p>
        </>
      );
    case "PUBLISHING":
      return <p className="text-tiny text-text-muted">{p.publisherId === viewerId ? "You're launching this" : p.publisher ? `${firstName(p.publisher.name)} is launching this` : "Waiting for a launcher"}</p>;
    case "LIVE":
      return (
        <p className="flex items-center gap-1.5 text-tiny text-text-muted">
          <LiveDot />
          {p.hoursThisMonth ? `${plural(p.hoursThisMonth, "hour")} saved this month` : "Live"}
        </p>
      );
    default:
      return null;
  }
}

export function PipelineBoard({ projects, viewerId, now }: { projects: ProjectSummary[]; viewerId: string; now: Date }) {
  return (
    <div className="-mx-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
      <div className="grid min-w-max grid-cols-5 gap-3 lg:min-w-0">
        {COLUMNS.map((stage) => {
          const items = projects.filter((p) => p.stage === stage).sort((a, b) => Number(!!b.blockedAt) - Number(!!a.blockedAt) || a.title.localeCompare(b.title));
          return (
            <section key={stage} className="w-64 rounded-container bg-subtle p-2 lg:w-auto">
              <h2 className="mb-2 flex items-center gap-1.5 px-1.5 pt-1 text-label font-semibold text-text">
                {STAGE_LABEL[stage]}
                <span className="font-normal text-text-faint">{items.length}</span>
              </h2>
              <div className="space-y-2">
                {items.map((p) => (
                  <Link key={p.id} href={`/ideas/${p.id}`} className="block rounded-control border border-border bg-surface p-3 hover:border-border-strong">
                    <p className="text-meta font-medium text-text">{p.title}</p>
                    <MetaLine className="mt-0.5" size="label" parts={[p.owner.name, p.topic.name]} />
                    <div className="mt-2.5">{p.blockedAt ? <StatusPill status="BLOCKED" /> : <CardStatus p={p} viewerId={viewerId} now={now} />}</div>
                  </Link>
                ))}
                {items.length === 0 && <p className="px-1.5 pb-2 text-tiny text-text-faint">Nothing here</p>}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
