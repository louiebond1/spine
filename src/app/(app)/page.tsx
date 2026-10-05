import { Box, FileText, MessageCircle } from "lucide-react";
import { Page } from "@/components/shell/Shell";
import { PageHeader } from "@/components/ui/PageHeader";
import { ActionList } from "@/features/home/ActionList";
import { YourWork } from "@/features/home/YourWork";
import { pageDate } from "@/lib/format";
import { now } from "@/server/clock";
import { getNeedsYou, type NeedsYouItem } from "@/server/home/needsYou";
import { getYourWork } from "@/server/projects/queries";
import { getCurrentUser } from "@/server/session";

const ICONS = { approval: FileText, question: MessageCircle, publishing: Box } as const;

function Reason({ reason }: { reason: NeedsYouItem["reason"] }) {
  return (
    <>
      {reason.before}
      {reason.emphasis && <strong className="font-semibold text-text">{reason.emphasis}</strong>}
      {reason.after}
    </>
  );
}

export default async function HomePage() {
  const user = await getCurrentUser();
  const needsYou = await getNeedsYou(user);
  const work = await getYourWork(user, needsYou.filter((n) => n.kind !== "question").map((n) => n.targetId));
  const n = needsYou.length;

  return (
    <Page>
      {n === 0 ? (
        <PageHeader date={pageDate(now())} title={"You’re all clear"} subtitle="Nothing is waiting on you" />
      ) : (
        <PageHeader date={pageDate(now())} title={`${n} ${n === 1 ? "thing needs" : "things need"} you`} />
      )}
      <div className="space-y-5">
        {n > 0 && (
          <ActionList
            items={needsYou.map((item) => ({
              key: item.key,
              icon: ICONS[item.kind],
              title: item.title,
              reason: <Reason reason={item.reason} />,
              href: item.action.href,
              actionLabel: item.action.label,
            }))}
          />
        )}
        <YourWork projects={work} />
      </div>
    </Page>
  );
}
