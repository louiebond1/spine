import Link from "next/link";
import { BadgeCheck, CalendarCheck, CircleCheck, FileText, MessageCircle, MessageSquareReply, Rocket, Share2, TrendingUp, UserPlus } from "lucide-react";
import { Page } from "@/components/shell/Shell";
import { PageHeader } from "@/components/ui/PageHeader";
import { Container } from "@/components/ui/Container";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { ActionList } from "@/features/home/ActionList";
import { YourWork } from "@/features/home/YourWork";
import { firstName, pageDate } from "@/lib/format";
import { now } from "@/server/clock";
import { requireCtx } from "@/server/ctx";
import { getNeedsYou, type NeedsYouItem } from "@/server/home/needsYou";
import { getYourWork } from "@/server/projects/queries";

const ICONS = {
  approval: FileText,
  question: MessageCircle,
  answer: MessageSquareReply,
  share: Share2,
  checkin: CalendarCheck,
  publishing: Rocket,
  verify: BadgeCheck,
  outcome: TrendingUp,
  invite: UserPlus,
} as const;

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
  const ctx = await requireCtx();
  const [needsYou, priorities, toolCount] = await Promise.all([
    getNeedsYou(ctx),
    ctx.db.priority.findMany({ where: { active: true }, orderBy: { position: "asc" }, take: 3 }),
    ctx.db.tool.count({ where: { status: { in: ["APPROVED", "LIMITED"] } } }),
  ]);
  const work = await getYourWork(ctx, needsYou.filter((n) => !["question", "answer", "share", "invite"].includes(n.kind)).map((n) => n.targetId));
  const n = needsYou.length;

  return (
    <Page>
      <PageHeader
        size="home"
        date={pageDate(now())}
        title={n === 0 ? "You're all clear" : `${n} ${n === 1 ? "thing needs" : "things need"} you`}
        subtitle={n === 0 ? `Nothing is waiting on you, ${firstName(ctx.user.name)}.` : undefined}
      />
      <div className="grid gap-6 lg:grid-cols-main-rail">
        <div className="min-w-0 space-y-6">
          {n > 0 && (
            <ActionList
              items={needsYou.map((item) => ({
                key: item.key,
                icon: ICONS[item.kind],
                tone: item.kind === "approval" || item.kind === "checkin" ? "brand" : "neutral",
                title: item.title,
                reason: <Reason reason={item.reason} />,
                href: item.action.href,
                actionLabel: item.action.label,
              }))}
            />
          )}
          <YourWork projects={work} />
        </div>
        <aside className="space-y-6">
          <Container heading="Our AI priorities" action={<Link href="/playbook" className="text-label font-medium text-brand hover:text-brand-hover">Playbook</Link>} variant="plain">
            {priorities.length === 0 ? (
              <p className="text-label text-text-muted">Your admins haven't published priorities yet.</p>
            ) : (
              <ol className="space-y-3">
                {priorities.map((p, i) => (
                  <li key={p.id} className="flex gap-3">
                    <span className="mt-0.5 text-label font-semibold text-text-faint">{i + 1}</span>
                    <span>
                      <span className="block text-meta font-medium text-text">{p.title}</span>
                      <span className="line-clamp-2 block text-label text-text-muted">{p.description}</span>
                    </span>
                  </li>
                ))}
              </ol>
            )}
            <p className="mt-4 flex items-center gap-2 border-t border-border pt-3 text-label text-text-muted">
              <CircleCheck size={14} aria-hidden className="text-positive" />
              {toolCount} approved {toolCount === 1 ? "tool" : "tools"} in the Playbook
            </p>
          </Container>
          <div className="space-y-2 px-1">
            <SectionLabel>Start something</SectionLabel>
            <Link href="?ask=1" className="block text-meta text-text hover:text-brand">
              Ask the Help Desk a question
            </Link>
            <Link href="/ideas/new" className="block text-meta text-text hover:text-brand">
              Propose an idea for an AI initiative
            </Link>
            <Link href="/discover?share=1" className="block text-meta text-text hover:text-brand">
              Share something that worked for you
            </Link>
          </div>
        </aside>
      </div>
    </Page>
  );
}
