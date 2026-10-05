import { Page } from "@/components/shell/Shell";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/States";
import { pageDate } from "@/lib/format";
import { now } from "@/server/clock";

// Phase 2 builds Home. This placeholder keeps the shell reviewable in Phase 1.
export default function HomePage() {
  return (
    <Page>
      <PageHeader date={pageDate(now())} title="Home" />
      <EmptyState>Home is built in Phase 2.</EmptyState>
    </Page>
  );
}
