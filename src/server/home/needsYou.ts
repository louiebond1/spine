import "server-only";
import { cache } from "react";
import type { User } from "@prisma/client";
import { hoursUntil } from "@/lib/format";
import { now } from "../clock";
import { db } from "../db";
import { lastSpeakerIsAsker } from "../questions/waiting";

// CLAUDE.md section 7, Home: what needs the current user, in this order.

export type NeedsYouItem = {
  key: string;
  kind: "approval" | "question" | "publishing";
  /** Project or question id, used to keep these out of "Your work". */
  targetId: string;
  title: string;
  /** Reason line. `emphasis` is shown with weight, never colour. */
  reason: { before: string; emphasis?: string; after?: string };
  action: { label: string; href: string };
};

export const getNeedsYou = cache(async (user: User): Promise<NeedsYouItem[]> => {
  const t = now();

  // 1. Approvals waiting on them (admins only, never their own ideas), soonest auto-approve first.
  const approvals = user.isAdmin
    ? await db.project.findMany({
        where: { stage: "APPROVAL", ownerId: { not: user.id } },
        orderBy: { autoApproveAt: "asc" },
        select: { id: true, title: true, autoApproveAt: true },
      })
    : [];

  // 2. Questions they've claimed that are waiting on them.
  const claimed = await db.question.findMany({
    where: { status: "IN_PROGRESS", claimerId: user.id },
    include: { asker: true, messages: { orderBy: { sentAt: "desc" }, take: 1, select: { authorId: true, sentAt: true } } },
  });
  const waiting = claimed
    .filter((q) => lastSpeakerIsAsker(q))
    .sort((a, b) => (a.messages[0]?.sentAt ?? a.postedAt).getTime() - (b.messages[0]?.sentAt ?? b.postedAt).getTime());

  // 3. Projects in Publishing assigned to them.
  const publishing = await db.project.findMany({
    where: { stage: "PUBLISHING", publisherId: user.id },
    orderBy: { publishingAssignedAt: "asc" },
    select: { id: true, title: true },
  });

  return [
    ...approvals.map((p) => ({
      key: `approval-${p.id}`,
      kind: "approval" as const,
      targetId: p.id,
      title: p.title,
      reason: p.autoApproveAt
        ? { before: "Auto-approves in ", emphasis: `${hoursUntil(p.autoApproveAt, t)}h`, after: " unless you review it" }
        : { before: "Waiting for your review" },
      action: { label: "Review", href: `/ideas/${p.id}/approve` },
    })),
    ...waiting.map((q) => ({
      key: `question-${q.id}`,
      kind: "question" as const,
      targetId: q.id,
      title: q.title,
      reason: { before: `${q.isAnonymous ? "The asker" : q.asker.name} is waiting on your reply` },
      action: { label: "Reply", href: `/help-desk/${q.id}` },
    })),
    ...publishing.map((p) => ({
      key: `publishing-${p.id}`,
      kind: "publishing" as const,
      targetId: p.id,
      title: p.title,
      reason: { before: "Ready for you to publish" },
      action: { label: "Open", href: `/ideas/${p.id}` },
    })),
  ];
});
