import Link from "next/link";
import { Row } from "@/components/ui/Row";
import { Avatar } from "@/components/ui/Avatar";
import { MetaLine } from "@/components/ui/MetaLine";
import { plural, shortDate, timeAgo } from "@/lib/format";
import type { QuestionDTO } from "@/server/questions/queries";
import { ClaimButton } from "./ClaimButton";

export function QuestionRow({ q, now, view }: { q: QuestionDTO; now: Date; view: "queue" | "mine" | "answers" }) {
  if (view === "answers") {
    return (
      <Row
        density="compact"
        title={q.title}
        href={`/help-desk/${q.id}`}
        meta={<MetaLine size="label" parts={[q.topic, q.claimer ? `Answered by ${q.claimer.name}` : null, q.sharedAt ? `Shared ${shortDate(q.sharedAt)}` : null]} />}
      />
    );
  }
  let trailing: React.ReactNode = null;
  if (q.status === "UNCLAIMED" && q.canClaim) trailing = <ClaimButton questionId={q.id} />;
  else if (q.waitingOnViewer)
    trailing = (
      <Link href={`/help-desk/${q.id}`} className="text-label font-medium text-brand hover:text-brand-hover">
        Reply
      </Link>
    );
  const status =
    q.status === "UNCLAIMED"
      ? `Asked ${timeAgo(q.postedAt, now)}`
      : q.status === "IN_PROGRESS"
        ? q.claimer?.isViewer
          ? "Claimed by you"
          : `With ${q.claimer?.name ?? "a Champion"}`
        : `Resolved${q.resolvedAt ? ` ${shortDate(q.resolvedAt)}` : ""}${q.sharedAt ? " · shared" : ""}`;
  return (
    <Row
      density="compact"
      leading={<Avatar initials={q.asker.initials} size="sm" />}
      title={q.title}
      href={q.canOpen ? `/help-desk/${q.id}` : undefined}
      meta={<MetaLine size="label" parts={[q.askedByViewer ? "You" : q.asker.name, q.topic, status, q.status !== "UNCLAIMED" ? plural(q.replyCount, "reply", "replies") : null]} />}
      trailing={trailing}
    />
  );
}
