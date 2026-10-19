import { notFound } from "next/navigation";
import { AlertOctagon, BadgeCheck, CalendarX, Clock, Hourglass, ListTodo, MessageCircle } from "lucide-react";
import { Page } from "@/components/shell/Shell";
import { PageHeader } from "@/components/ui/PageHeader";
import { Container } from "@/components/ui/Container";
import { EmptyState } from "@/components/ui/States";
import { ActionList } from "@/features/home/ActionList";
import { pageDate } from "@/lib/format";
import { now } from "@/server/clock";
import { requireCtx } from "@/server/ctx";
import { can } from "@/server/permissions";
import { CHECK_LABEL, getPulse, type PulseCheck } from "@/server/pulse/pulse";

const ICONS: Record<PulseCheck, typeof Clock> = { blocked: AlertOctagon, approval: Clock, question: MessageCircle, checkin: CalendarX, overdue: ListTodo, build: Hourglass, outcome: BadgeCheck };

/** Momentum: what's stuck or going quiet across the programme, so someone can act before it dies. */
export default async function PulsePage() {
  const ctx = await requireCtx();
  if (!can.seePulse(ctx.user)) notFound();
  const groups = await getPulse(ctx);
  const total = groups.reduce((n, g) => n + g.total, 0);

  // Each item only offers an action the viewer can actually take.
  const ids = groups.flatMap((g) => g.items.map((i) => i.targetId));
  const [questions, projects] = await Promise.all([ctx.db.question.findMany({ where: { id: { in: ids } } }), ctx.db.project.findMany({ where: { id: { in: ids } } })]);
  const canAct = (check: PulseCheck, targetId: string) => {
    if (check === "question") {
      const q = questions.find((x) => x.id === targetId);
      return !!q && can.claimQuestion(ctx.user, q);
    }
    if (check === "approval") {
      const p = projects.find((x) => x.id === targetId);
      return !!p && can.approve(ctx.user, p);
    }
    return true;
  };

  return (
    <Page>
      <PageHeader date={pageDate(now())} title="Pulse" subtitle="Anything blocked, waiting or going quiet across your AI programme. It's also posted to your team channel each morning." />
      {total === 0 ? (
        <Container variant="plain">
          <EmptyState className="py-2">Nothing is stuck or going quiet right now.</EmptyState>
        </Container>
      ) : (
        <div className="space-y-4">
          {groups.map((g, gi) => (
            <ActionList
              key={g.check}
              heading={CHECK_LABEL[g.check]}
              count={g.total}
              primaryFirst={gi === 0}
              items={g.items.map((item) => ({
                key: item.key,
                icon: ICONS[item.check],
                tone: item.check === "blocked" ? "critical" : "neutral",
                title: item.title,
                reason: item.reason,
                href: item.action.href,
                actionLabel: canAct(item.check, item.targetId) ? item.action.label : "Open",
              }))}
            />
          ))}
        </div>
      )}
    </Page>
  );
}
