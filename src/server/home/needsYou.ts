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
  kind: "approval" | "question" | "publishing" | "invite";
  /** Project or question id, used to keep these out of "Your work". */
  targetId: string;
  title: string;
  /** Reason line. `emphasis` is shown with weight, never colour. */
  reason: { before: string; emphasis?: string; after?: string };
  action: { label: string; href: string };
};

export const getNeedsYou = cache(async (user: User): Promise<NeedsYouItem[]> => {
  const t = now();

  // 1. Approvals waiting on them (never their own ideas), soonest auto-approve first. The approval
  // rule names the approvers; with none named, any admin approves. Skip ones they already signed.
  const approvals = await db.project.findMany({
    where: {
      stage: "APPROVAL",
      ownerId: { not: user.id },
      approvals: { none: { userId: user.id } },
      OR: [{ approverIds: { has: user.id } }, ...(user.isAdmin ? [{ approverIds: { isEmpty: true } }] : [])],
    },
    orderBy: [{ autoApproveAt: { sort: "asc", nulls: "last" } }, { submittedAt: "asc" }],
    select: { id: true, title: true, autoApproveAt: true, approvalsNeeded: true, _count: { select: { approvals: true } } },
  });

  // 2. Questions they've claimed that are waiting on them.
  const claimed = await db.question.findMany({
    where: { status: "IN_PROGRESS", claimerId: user.id },
    include: { asker: true, messages: { orderBy: [{ sentAt: "desc" }, { createdAt: "desc" }], take: 1, select: { authorId: true, sentAt: true } } },
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

  // 4. Invites to join a project (from "Start with Spine").
  const invites = await db.projectInvite.findMany({
    where: { userId: user.id, status: "PENDING", project: { stage: { not: "LIVE" } } },
    include: { project: { select: { id: true, title: true } } },
    orderBy: { createdAt: "asc" },
  });
  const inviters = await db.user.findMany({ where: { id: { in: invites.map((i) => i.invitedById) } }, select: { id: true, name: true } });

  return [
    ...approvals.map((p) => ({
      key: `approval-${p.id}`,
      kind: "approval" as const,
      targetId: p.id,
      title: p.title,
      reason: p.autoApproveAt
        ? { before: "Auto-approves in ", emphasis: `${hoursUntil(p.autoApproveAt, t)}h`, after: " unless you review it" }
        : p.approvalsNeeded > 1
          ? { before: "Needs your approval, ", emphasis: `${p._count.approvals} of ${p.approvalsNeeded}`, after: " approvals in" }
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
    ...invites.map((i) => ({
      key: `invite-${i.id}`,
      kind: "invite" as const,
      targetId: i.project.id,
      title: i.project.title,
      reason: { before: `${inviters.find((u) => u.id === i.invitedById)?.name ?? "Someone"} invited you to join the team` },
      action: { label: "Open", href: `/ideas/${i.project.id}?tab=team` },
    })),
  ];
});
