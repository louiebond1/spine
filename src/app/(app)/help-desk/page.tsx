import { Suspense } from "react";
import { Page } from "@/components/shell/Shell";
import { PageHeader } from "@/components/ui/PageHeader";
import { Container } from "@/components/ui/Container";
import { Tabs } from "@/components/ui/Tabs";
import { EmptyState } from "@/components/ui/States";
import { QuestionRow } from "@/features/help-desk/QuestionRow";
import { SearchQuestions } from "@/features/help-desk/SearchQuestions";
import { pageDate } from "@/lib/format";
import { now } from "@/server/clock";
import { countMine, listQuestions, type HelpDeskTab, type QuestionDTO } from "@/server/questions/queries";
import { getCurrentUser } from "@/server/session";

const TABS: HelpDeskTab[] = ["open", "mine", "resolved", "all"];

function Group({ heading, items, t }: { heading: string; items: QuestionDTO[]; t: Date }) {
  return (
    <Container heading={heading} count={items.length}>
      {items.map((q) => (
        <QuestionRow key={q.id} q={q} now={t} />
      ))}
    </Container>
  );
}

export default async function HelpDeskPage({ searchParams }: { searchParams: Promise<{ tab?: string; q?: string }> }) {
  const params = await searchParams;
  const tab: HelpDeskTab = TABS.includes(params.tab as HelpDeskTab) ? (params.tab as HelpDeskTab) : "open";
  const search = params.q ?? "";
  const user = await getCurrentUser();
  const [groups, mine] = await Promise.all([listQuestions(tab, search, user), countMine(user)]);
  const t = now();

  const href = (key: HelpDeskTab) => `/help-desk?tab=${key}${search ? `&q=${encodeURIComponent(search)}` : ""}`;
  const sections =
    tab === "resolved"
      ? [{ heading: "Resolved", items: groups.resolved }]
      : [
          { heading: "Unclaimed", items: groups.unclaimed },
          { heading: "In progress", items: groups.inProgress },
          ...(tab === "all" ? [{ heading: "Resolved", items: groups.resolved }] : []),
        ];
  const visible = sections.filter((s) => s.items.length > 0);

  return (
    <Page>
      <PageHeader date={pageDate(t)} title="Help Desk" />
      <div className="-mt-3 mb-3 flex items-center justify-between">
        <Tabs
          active={tab}
          tabs={[
            { key: "open", label: "Open", href: href("open") },
            { key: "mine", label: "Mine", href: href("mine"), count: mine },
            { key: "resolved", label: "Resolved", href: href("resolved") },
            { key: "all", label: "All", href: href("all") },
          ]}
        />
        <Suspense>
          <SearchQuestions />
        </Suspense>
      </div>
      <div className="space-y-5">
        {visible.length === 0 ? (
          <Container>
            <EmptyState>{search ? "No questions match that search." : "No questions here yet."}</EmptyState>
          </Container>
        ) : (
          visible.map((s) => <Group key={s.heading} heading={s.heading} items={s.items} t={t} />)
        )}
      </div>
    </Page>
  );
}
