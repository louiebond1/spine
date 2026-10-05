import Link from "next/link";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { EmptyState } from "@/components/ui/States";
import { ICON_STROKE } from "@/components/ui/icons";
import { NextActionLine } from "@/features/home/YourWork";
import { STAGE_LABEL } from "@/server/projects/lifecycle";
import type { ProjectSummary } from "@/server/projects/queries";

const STAGE_RANK = { IDEA: 0, APPROVAL: 1, RECRUITING: 2, BUILDING: 3, PUBLISHING: 4, LIVE: 5 } as const;

/** List view: one container with title, owner, stage, build path and next action. Sortable by stage. */
export function ProjectList({ projects, sort, sortHref }: { projects: ProjectSummary[]; sort: "stage" | "stage-desc" | null; sortHref: string }) {
  const rows = sort
    ? [...projects].sort((a, b) => (STAGE_RANK[a.stage] - STAGE_RANK[b.stage]) * (sort === "stage" ? 1 : -1))
    : projects;
  const grid = "grid grid-cols-projects items-center gap-6";

  return (
    <Container>
      <div className={`${grid} border-b border-border py-4 text-label font-medium text-text-muted`}>
        <span>Title</span>
        <span>Owner</span>
        <Link href={sortHref} className="inline-flex items-center gap-1 hover:text-text">
          Stage
          {sort === "stage" && <ChevronUp size={14} strokeWidth={ICON_STROKE} aria-label="ascending" />}
          {sort === "stage-desc" && <ChevronDown size={14} strokeWidth={ICON_STROKE} aria-label="descending" />}
        </Link>
        <span>Build path</span>
        <span>Next action</span>
      </div>
      {rows.length === 0 ? (
        <EmptyState>No projects to show.</EmptyState>
      ) : (
        rows.map((p) => (
          <div key={p.id} className={`${grid} py-4`}>
            <Link href={p.stage === "IDEA" ? `/ideas/new?from=${p.id}` : `/ideas/${p.id}`} className="text-meta font-medium text-text hover:text-brand">
              {p.title}
            </Link>
            <span className="text-meta text-text-muted">{p.owner.name}</span>
            <span className="text-meta text-text-muted">{STAGE_LABEL[p.stage]}</span>
            <span className="text-meta text-text-muted">{p.buildPath === "APP" ? "App" : "Cowork-native"}</span>
            <NextActionLine next={p.next} />
          </div>
        ))
      )}
    </Container>
  );
}
