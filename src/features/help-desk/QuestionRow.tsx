import Link from "next/link";
import { Row } from "@/components/ui/Row";
import { Avatar } from "@/components/ui/Avatar";
import { MetaLine } from "@/components/ui/MetaLine";
import { plural, shortDate, timeAgo } from "@/lib/format";
import type { QuestionDTO } from "@/server/questions/queries";
import { ClaimButton } from "./ClaimButton";

export function QuestionRow({ q, now }: { q: QuestionDTO; now: Date }) {
  const third =
    q.status === "UNCLAIMED" ? timeAgo(q.postedAt, now) : plural(q.replyCount, "reply", "replies");

  let trailing: React.ReactNode = null;
  if (q.status === "UNCLAIMED" && q.canClaim) {
    trailing = <ClaimButton questionId={q.id} />;
  } else if (q.status === "IN_PROGRESS" && q.claimer) {
    trailing = q.claimer.isViewer ? (
      <>
        <span className="w-56 whitespace-nowrap text-meta text-text-muted">Claimed by you</span>
        <Link href={`/help-desk/${q.id}`} className="w-14 text-right text-meta font-medium text-brand hover:text-brand-hover">
          Reply
        </Link>
      </>
    ) : (
      <>
        <span className="w-56 whitespace-nowrap text-meta text-text-muted">Claimed by {q.claimer.name}</span>
        <span className="w-14" />
      </>
    );
  } else if (q.status === "RESOLVED") {
    trailing = (
      <span className="text-meta text-text-muted">
        Resolved by {q.claimer?.name ?? "the asker"}
        {q.resolvedAt && ` · ${shortDate(q.resolvedAt)}`}
      </span>
    );
  }

  return (
    <Row
      density="compact"
      leading={<Avatar initials={q.asker.initials} />}
      title={q.title}
      href={q.canOpen ? `/help-desk/${q.id}` : undefined}
      meta={<MetaLine parts={[q.asker.name, q.topic, third]} />}
      trailing={trailing}
    />
  );
}
