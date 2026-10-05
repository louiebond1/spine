import { Container } from "@/components/ui/Container";
import { Row } from "@/components/ui/Row";
import { Button } from "@/components/ui/Button";
import { LiveDot } from "@/components/ui/LiveDot";
import { EmptyState } from "@/components/ui/States";
import type { ProjectSummary } from "@/server/projects/queries";

export function NextActionLine({ next, strong }: { next: ProjectSummary["next"]; strong?: boolean }) {
  if (!next) return null;
  return (
    <p className={`flex items-center gap-3 text-meta ${strong ? "text-text" : "text-text-muted"}`}>
      {next.live && <LiveDot />}
      {next.text}
    </p>
  );
}

/** Home "Your work": title and status line only. */
export function YourWork({ projects }: { projects: ProjectSummary[] }) {
  return (
    <Container heading="Your work" action={<Button variant="text" arrow href="/ideas?view=list&owner=me">View all</Button>}>
      {projects.length === 0 ? (
        <EmptyState>Projects you own, join, approve or publish will show here.</EmptyState>
      ) : (
        projects.map((p) => <Row key={p.id} density="compact" href={`/ideas/${p.id}`} title={p.title} meta={<NextActionLine next={p.next} />} />)
      )}
    </Container>
  );
}
