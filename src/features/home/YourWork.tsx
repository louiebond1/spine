import { Container } from "@/components/ui/Container";
import { Row } from "@/components/ui/Row";
import { Button } from "@/components/ui/Button";
import { LiveDot } from "@/components/ui/LiveDot";
import { EmptyState } from "@/components/ui/States";
import { StatusPill } from "@/components/ui/StatusPill";
import { STAGE_LABEL } from "@/server/projects/lifecycle";
import type { ProjectSummary } from "@/server/projects/queries";

export function NextActionLine({ next, strong }: { next: ProjectSummary["next"]; strong?: boolean }) {
  if (!next) return null;
  return (
    <p className={`flex items-center gap-2 text-label ${strong ? "text-text" : "text-text-muted"}`}>
      {next.live && <LiveDot />}
      {next.text}
    </p>
  );
}

/** Home "Your initiatives": title, stage and what's happening now. */
export function YourWork({ projects }: { projects: ProjectSummary[] }) {
  return (
    <Container heading="Your initiatives" action={<Button variant="text" href="/ideas?view=list&person=me">View all</Button>}>
      {projects.length === 0 ? (
        <EmptyState>Initiatives you own, join, approve or launch will show here.</EmptyState>
      ) : (
        projects.map((p) => (
          <Row
            key={p.id}
            density="compact"
            href={`/ideas/${p.id}`}
            title={p.title}
            meta={<NextActionLine next={p.next} />}
            trailing={p.blockedAt ? <StatusPill status="BLOCKED" /> : <span className="text-label text-text-faint">{STAGE_LABEL[p.stage]}</span>}
          />
        ))
      )}
    </Container>
  );
}
