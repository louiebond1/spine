import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { MetaLine } from "@/components/ui/MetaLine";
import { ChatMessage } from "@/components/ui/ChatMessage";
import { Timeline } from "@/components/ui/Timeline";
import { EmptyState } from "@/components/ui/States";
import { ClaimButton } from "@/features/help-desk/ClaimButton";
import { ThreadComposer } from "@/features/help-desk/ThreadActions";
import { SuggestedAnswer } from "@/features/help-desk/SuggestedAnswer";
import { plural, shortDate, timeAgo } from "@/lib/format";
import { now } from "@/server/clock";
import { getThread } from "@/server/questions/queries";
import { getCurrentUser } from "@/server/session";

export default async function QuestionThreadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  const thread = await getThread(id, user);
  if (!thread) notFound();
  const t = now();
  const { question: q } = thread;

  const status =
    q.status === "RESOLVED"
      ? `Resolved by ${q.claimer?.name ?? "the asker"}${q.resolvedAt ? ` · ${shortDate(q.resolvedAt)}` : ""}`
      : q.claimer
        ? q.claimer.isViewer
          ? "Claimed by you"
          : `Claimed by ${q.claimer.name}`
        : "Unclaimed";

  return (
    <div className="mx-auto flex max-w-content gap-5">
      <div className="flex min-h-full min-w-0 flex-1 flex-col">
        <PageHeader
          back={{ href: "/help-desk", label: "Back to Help Desk" }}
          title={q.title}
          meta={<MetaLine parts={[q.asker.name, q.topic, plural(q.replyCount, "reply", "replies"), status]} />}
        />
        {!thread.readable ? (
          <EmptyState>This conversation is private to the asker and the Champion who claimed it.</EmptyState>
        ) : (
          <>
            <div className="flex-1 space-y-7 pb-8">
              <ChatMessage
                author={q.asker.name}
                initials={q.asker.initials}
                time={timeAgo(q.postedAt, t)}
                body={thread.body}
                mine={q.askedByViewer}
              />
              <SuggestedAnswer
                questionId={q.id}
                suggested={thread.suggested}
                askerCanAccept={thread.askerCanAccept}
                generate={q.status !== "RESOLVED"}
              />
              {thread.messages.map((m) => (
                <ChatMessage
                  key={m.id}
                  author={m.author.name}
                  initials={m.author.initials}
                  time={timeAgo(m.sentAt, t)}
                  body={m.body || undefined}
                  mine={m.mine}
                  attachments={m.attachments}
                />
              ))}
            </div>
            <div className="sticky bottom-0 bg-background pb-4">
              {q.status === "UNCLAIMED" && q.canClaim ? (
                <div className="flex justify-end">
                  <ClaimButton questionId={q.id} variant="primary" />
                </div>
              ) : (
                <ThreadComposer questionId={q.id} canPost={thread.canPost} canResolve={thread.canResolve} />
              )}
            </div>
          </>
        )}
      </div>
      {thread.readable && (
        <aside className="w-rail shrink-0">
          <div className="sticky top-24 rounded-container border border-border bg-surface px-6 py-6">
            <h2 className="mb-6 text-section font-semibold text-text">History</h2>
            <Timeline tone="brand" items={[...thread.history].map((h) => ({ key: h.id, text: h.text, time: timeAgo(h.at, t) }))} />
          </div>
        </aside>
      )}
    </div>
  );
}
