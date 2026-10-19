import { notFound } from "next/navigation";
import { Lock } from "lucide-react";
import { Page } from "@/components/shell/Shell";
import { PageHeader } from "@/components/ui/PageHeader";
import { MetaLine } from "@/components/ui/MetaLine";
import { ChatMessage } from "@/components/ui/ChatMessage";
import { Timeline } from "@/components/ui/Timeline";
import { Container } from "@/components/ui/Container";
import { ClaimButton } from "@/features/help-desk/ClaimButton";
import { ThreadComposer } from "@/features/help-desk/ThreadActions";
import { SuggestedAnswer } from "@/features/help-desk/SuggestedAnswer";
import { SharePanel } from "@/features/help-desk/SharePanel";
import { plural, shortDate, timeAgo } from "@/lib/format";
import { now } from "@/server/clock";
import { requireCtx } from "@/server/ctx";
import { aiConfigured } from "@/server/ai/client";
import { getSharedAnswer, getThread } from "@/server/questions/queries";

export default async function QuestionThreadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireCtx();
  const thread = await getThread(ctx, id);

  if (!thread) {
    // Not a participant: the only thing anyone else may see is an answer the asker chose to share.
    const shared = await getSharedAnswer(ctx, id);
    if (!shared) notFound();
    return (
      <Page width="narrow">
        <PageHeader back={{ href: "/help-desk?tab=answers", label: "Shared answers" }} title={shared.title} meta={<MetaLine size="label" parts={[shared.topic, shared.answeredBy ? `Answered by ${shared.answeredBy}` : null, `Shared ${shortDate(shared.sharedAt)}`]} />} />
        <Container variant="plain">
          <p className="whitespace-pre-line text-body text-text">{shared.answer}</p>
        </Container>
        <p className="mt-3 text-label text-text-muted">A summary the asker chose to share. The original conversation stays private.</p>
      </Page>
    );
  }

  const t = now();
  const { question: q } = thread;
  const status =
    q.status === "RESOLVED"
      ? `Resolved${q.claimer ? ` by ${q.claimer.isViewer ? "you" : q.claimer.name}` : ""}${q.resolvedAt ? ` · ${shortDate(q.resolvedAt)}` : ""}`
      : q.claimer
        ? q.claimer.isViewer
          ? "Claimed by you"
          : `With ${q.claimer.name}`
        : "Waiting for a Champion";

  return (
    <Page>
      <PageHeader
        back={{ href: "/help-desk", label: "Help Desk" }}
        title={q.title}
        meta={<MetaLine size="label" parts={[q.askedByViewer ? "You" : q.asker.name, q.topic, plural(q.replyCount, "reply", "replies"), status]} />}
      />
      <div className="grid gap-6 lg:grid-cols-main-rail">
        <div className="flex min-w-0 flex-col">
          <p className="mb-4 flex items-center gap-1.5 text-label text-text-muted">
            <Lock size={13} aria-hidden />
            {thread.participant ? "Private to the asker and the Champion who claims it." : "You're previewing this question so you can decide whether to claim it."}
          </p>
          <div className="flex-1 space-y-6 pb-6">
            <ChatMessage author={q.asker.name} initials={q.asker.initials} time={timeAgo(q.postedAt, t)} body={thread.body} mine={q.askedByViewer} />
            {thread.participant && <SuggestedAnswer questionId={q.id} suggested={thread.suggested} askerCanAccept={thread.askerCanAccept} generate={q.status !== "RESOLVED" && q.replyCount === 0 && aiConfigured()} />}
            {thread.bestMatch && (
              <p className="text-label text-text-muted sm:ml-11">
                Likely best Champion: <span className="font-medium text-text">{thread.bestMatch.id === ctx.user.id ? "you" : thread.bestMatch.name}</span> ({thread.bestMatch.answered} {q.topic} {thread.bestMatch.answered === 1 ? "answer" : "answers"})
              </p>
            )}
            {thread.messages.map((m) => (
              <ChatMessage key={m.id} author={m.author.name} initials={m.author.initials} time={timeAgo(m.sentAt, t)} body={m.body || undefined} mine={m.mine} attachments={m.attachments} />
            ))}
          </div>
          {q.status === "RESOLVED" && <SharePanel questionId={q.id} summary={thread.share.summary} sharedAt={thread.share.sharedAt} canShare={thread.share.canShare} canSuggest={thread.share.canSuggest} />}
          <div className="sticky bottom-0 bg-background pb-4 pt-2">
            {q.status === "UNCLAIMED" && q.canClaim ? (
              <div className="flex justify-end">
                <ClaimButton questionId={q.id} variant="primary" />
              </div>
            ) : (
              <ThreadComposer questionId={q.id} canPost={thread.canPost} canResolve={thread.canResolve} />
            )}
          </div>
        </div>
        {thread.history.length > 0 && (
          <aside className="hidden lg:block">
            <div className="sticky top-20">
              <Container heading="History" variant="plain">
                <Timeline tone="brand" items={thread.history.map((h) => ({ key: h.id, text: h.text, time: timeAgo(h.at, t) }))} />
              </Container>
            </div>
          </aside>
        )}
      </div>
    </Page>
  );
}
