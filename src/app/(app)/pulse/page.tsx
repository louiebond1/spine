import { Clock, Hourglass, MessageCircle } from "lucide-react";
import { Page } from "@/components/shell/Shell";
import { PageHeader } from "@/components/ui/PageHeader";
import { Container } from "@/components/ui/Container";
import { EmptyState } from "@/components/ui/States";
import { ActionList } from "@/features/home/ActionList";
import { ClaimButton } from "@/features/help-desk/ClaimButton";
import { pageDate } from "@/lib/format";
import { now } from "@/server/clock";
import { db } from "@/server/db";
import { can } from "@/server/permissions";
import { getPulseItems } from "@/server/pulse/pulse";
import { getCurrentUser } from "@/server/session";

const ICONS = { approval: Clock, question: MessageCircle, build: Hourglass } as const;

export default async function PulsePage() {
  const [user, items] = await Promise.all([getCurrentUser(), getPulseItems()]);

  // Everyone sees the same nudges; the action button only shows when the viewer can act (PLAN.md Q18).
  const canAct = await Promise.all(
    items.map(async (item) => {
      if (item.check === "build") return true;
      if (item.check === "question") {
        const q = await db.question.findUnique({ where: { id: item.targetId } });
        return !!q && can.claimQuestion(user, q);
      }
      const p = await db.project.findUnique({ where: { id: item.targetId } });
      return !!p && can.approve(user, p);
    }),
  );

  return (
    <Page>
      <PageHeader date={pageDate(now())} title="Worth your attention today" />
      {items.length === 0 ? (
        <Container>
          <EmptyState>Nothing is going quiet right now.</EmptyState>
        </Container>
      ) : (
        <ActionList
          items={items.map((item, i) => ({
            key: item.key,
            icon: ICONS[item.check],
            title: item.title,
            reason: item.reason,
            href: item.action.href,
            actionLabel: canAct[i] ? item.action.label : undefined,
            action:
              item.check === "question" && canAct[i]
                ? (variant) => <ClaimButton questionId={item.targetId} variant={variant} arrow />
                : undefined,
          }))}
        />
      )}
    </Page>
  );
}
