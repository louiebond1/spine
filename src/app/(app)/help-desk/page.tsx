import { Suspense } from "react";
import { Page } from "@/components/shell/Shell";
import { PageHeader } from "@/components/ui/PageHeader";
import { Container } from "@/components/ui/Container";
import { Tabs } from "@/components/ui/Tabs";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { EmptyState } from "@/components/ui/States";
import { QuestionRow } from "@/features/help-desk/QuestionRow";
import { SearchQuestions } from "@/features/help-desk/SearchQuestions";
import { startOfMonth } from "@/lib/tz";
import { now } from "@/server/clock";
import { requireCtx } from "@/server/ctx";
import { can } from "@/server/permissions";
import { championsThisMonth, countMine, defaultTab, listQuestions, type HelpDeskTab } from "@/server/questions/queries";

const EMPTY: Record<HelpDeskTab, string> = {
  queue: "No open questions. Nice work.",
  mine: "Questions you ask or claim show here. Your conversations are private to you and your Champion.",
  answers: "Answers people choose to share show here.",
};

export default async function HelpDeskPage({ searchParams }: { searchParams: Promise<{ tab?: string; q?: string }> }) {
  const ctx = await requireCtx();
  const params = await searchParams;
  const allowed: HelpDeskTab[] = can.seeQueue(ctx.user) ? ["queue", "mine", "answers"] : ["mine", "answers"];
  const tab: HelpDeskTab = allowed.includes(params.tab as HelpDeskTab) ? (params.tab as HelpDeskTab) : defaultTab(ctx.user);
  const search = params.q ?? "";
  const t = now();
  const [{ groups }, mine, champions] = await Promise.all([listQuestions(ctx, tab, search), countMine(ctx), championsThisMonth(ctx, startOfMonth(t))]);
  const href = (key: HelpDeskTab) => `/help-desk?tab=${key}${search ? `&q=${encodeURIComponent(search)}` : ""}`;
  const visible = groups.filter((g) => g.items.length > 0);

  return (
    <Page>
      <PageHeader
        title="Help Desk"
        subtitle="Ask anything about using AI at work. A Champion answers you privately. Answers people choose to share help everyone."
        aside={<Button variant="primary" href="?ask=1">Ask a question</Button>}
      />
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <Tabs
          className="flex-1"
          active={tab}
          tabs={[
            ...(allowed.includes("queue") ? [{ key: "queue", label: "Queue", href: href("queue") }] : []),
            { key: "mine", label: "Mine", href: href("mine"), count: mine },
            { key: "answers", label: "Shared answers", href: href("answers") },
          ]}
        />
        <Suspense>
          <SearchQuestions />
        </Suspense>
      </div>
      <div className="grid gap-6 lg:grid-cols-main-rail">
        <div className="min-w-0 space-y-4">
          {visible.length === 0 ? (
            <Container variant="plain">
              <EmptyState className="py-2">{search ? "No questions match that search." : EMPTY[tab]}</EmptyState>
            </Container>
          ) : (
            visible.map((g) => (
              <Container key={g.heading} heading={g.heading} count={g.items.length}>
                {g.items.map((q) => (
                  <QuestionRow key={q.id} q={q} now={t} view={tab} />
                ))}
              </Container>
            ))
          )}
        </div>
        <aside>
          <Container heading="Champions this month" variant="plain">
            {champions.length === 0 ? (
              <p className="text-label text-text-muted">No questions resolved yet this month.</p>
            ) : (
              <ul className="space-y-2.5">
                {champions.map((c) => (
                  <li key={c.user.id} className="flex items-center gap-2.5">
                    <Avatar initials={c.user.initials} size="sm" />
                    <span className="flex-1 truncate text-meta text-text">{c.user.name}</span>
                    <span className="text-label text-text-muted">{c.answered} answered</span>
                  </li>
                ))}
              </ul>
            )}
          </Container>
        </aside>
      </div>
    </Page>
  );
}
