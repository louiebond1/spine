import Link from "next/link";
import type { ProjectStage } from "@prisma/client";
import { LiveDot } from "@/components/ui/LiveDot";
import { MetaLine } from "@/components/ui/MetaLine";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { firstName, plural } from "@/lib/format";
import { startOfDay } from "@/lib/tz";
import type { ProjectSummary } from "@/server/projects/queries";

const COLUMNS: { stage: ProjectStage; label: string }[] = [
  { stage: "APPROVAL", label: "Approval" },
  { stage: "RECRUITING", label: "Recruiting" },
  { stage: "BUILDING", label: "Building" },
  { stage: "PUBLISHING", label: "Publishing" },
  { stage: "LIVE", label: "Live" },
];

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

/** Stage-specific status line for compact cards (PLAN.md Q35). */
function CardStatus({ p, viewerId, now }: { p: ProjectSummary; viewerId: string; now: Date }) {
  switch (p.stage) {
    case "APPROVAL": {
      if (p.autoApproveAt && p.autoApproveAt.getTime() - now.getTime() < DAY) {
        const hours = Math.max(1, Math.ceil((p.autoApproveAt.getTime() - now.getTime()) / HOUR));
        return <p className="text-label text-text">Auto-approves in {plural(hours, "hour")}</p>;
      }
      const days = p.submittedAt ? Math.round((startOfDay(now).getTime() - startOfDay(p.submittedAt).getTime()) / DAY) : 0;
      return <p className="text-label text-text">{days === 0 ? "Submitted today" : `Submitted ${plural(days, "day")} ago`}</p>;
    }
    case "RECRUITING":
      return (
        <>
          <ProgressBar value={p.team.length} max={p.teamSize} />
          <p className="mt-3 text-label text-text">
            {p.team.length} of {p.teamSize} people
          </p>
        </>
      );
    case "BUILDING":
      return (
        <>
          <ProgressBar value={p.stepsDone} max={p.steps.length} />
          <p className="mt-3 text-label text-text">
            {p.steps.length ? `${p.stepsDone} of ${p.steps.length} steps` : "Writing the build plan"}
          </p>
        </>
      );
    case "PUBLISHING":
      return (
        <p className="text-label text-text">
          {p.publisherId === viewerId ? "You’re publishing this" : p.publisher ? `${firstName(p.publisher.name)} is publishing this` : ""}
        </p>
      );
    case "LIVE":
      return (
        <p className="flex items-center gap-2 text-label text-text">
          <LiveDot />
          {plural(p.hoursThisMonth, "hour")} saved this month
        </p>
      );
    default:
      return null;
  }
}

export function PipelineBoard({ projects, viewerId, now }: { projects: ProjectSummary[]; viewerId: string; now: Date }) {
  return (
    <div className="grid grid-cols-5 divide-x divide-border">
      {COLUMNS.map((col) => {
        // Alphabetical within a column, so cards stay put as activity changes.
        const items = projects.filter((p) => p.stage === col.stage).sort((a, b) => a.title.localeCompare(b.title));
        return (
          <section key={col.stage} className="min-h-96 px-3 first:pl-0 last:pr-0">
            <h2 className="mb-4 text-row-title font-semibold text-text">
              {col.label} <span className="ml-1 font-normal text-text-muted">({items.length})</span>
            </h2>
            <div className="space-y-3">
              {items.map((p) => (
                <Link key={p.id} href={`/ideas/${p.id}`} className="block rounded-control border border-border bg-surface px-4 py-4 hover:border-text-muted">
                  <p className="text-label font-semibold text-text">{p.title}</p>
                  <MetaLine className="mt-1" size="label" parts={[p.owner.name, p.topic.name, p.buildPath === "APP" ? "App" : "Cowork-native"]} />
                  <div className="mt-3">
                    <CardStatus p={p} viewerId={viewerId} now={now} />
                  </div>
                </Link>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
