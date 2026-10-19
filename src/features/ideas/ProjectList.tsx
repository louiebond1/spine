import Link from "next/link";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { EmptyState } from "@/components/ui/States";
import { StatusPill } from "@/components/ui/StatusPill";
import { ICON_STROKE } from "@/components/ui/icons";
import { NextActionLine } from "@/features/home/YourWork";
import { STAGE_LABEL } from "@/server/projects/lifecycle";
import type { ProjectSummary } from "@/server/projects/queries";

const STAGE_RANK = { IDEA: 0, APPROVAL: 1, RECRUITING: 2, BUILDING: 3, PUBLISHING: 4, LIVE: 5 } as const;

export function ProjectList({ projects, sort, sortHref }: { projects: ProjectSummary[]; sort: "stage" | "stage-desc" | null; sortHref: string }) {
  const rows = sort ? [...projects].sort((a, b) => (STAGE_RANK[a.stage] - STAGE_RANK[b.stage]) * (sort === "stage" ? 1 : -1)) : projects;
  return (
    <Container>
      <div className="hidden grid-cols-projects items-center gap-4 border-b border-border py-2.5 text-label font-medium text-text-muted md:grid">
        <span>Initiative</span>
        <span>Owner</span>
        <Link href={sortHref} className="inline-flex items-center gap-1 hover:text-text">
          Stage
          {sort === "stage" && <ChevronUp size={13} strokeWidth={ICON_STROKE} aria-label="ascending" />}
          {sort === "stage-desc" && <ChevronDown size={13} strokeWidth={ICON_STROKE} aria-label="descending" />}
        </Link>
        <span>Now</span>
      </div>
      {rows.length === 0 ? (
        <EmptyState>No initiatives to show.</EmptyState>
      ) : (
        rows.map((p) => (
          <div key={p.id} className="grid gap-1 py-3 md:grid-cols-projects md:items-center md:gap-4">
            <Link href={p.stage === "IDEA" ? `/ideas/new?from=${p.id}` : `/ideas/${p.id}`} className="text-meta font-medium text-text hover:text-brand">
              {p.title}
            </Link>
            <span className="text-label text-text-muted">{p.owner.name}</span>
            <span className="text-label text-text-muted">{p.blockedAt ? <StatusPill status="BLOCKED" /> : STAGE_LABEL[p.stage]}</span>
            <NextActionLine next={p.next} />
          </div>
        ))
      )}
    </Container>
  );
}
