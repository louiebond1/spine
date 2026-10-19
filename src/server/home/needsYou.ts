import "server-only";
import { cache } from "react";
import { hoursUntil } from "@/lib/format";
import { startOfMonth, zonedParts } from "@/lib/tz";
import { now } from "../clock";
import type { Ctx } from "../ctx";

// Home: what needs the signed-in person, in priority order. Every item has one clear action.

export type NeedsYouKind = "approval" | "question" | "answer" | "share" | "checkin" | "publishing" | "verify" | "outcome" | "invite";

export type NeedsYouItem = {
  key: string;
  kind: NeedsYouKind;
  /** Project or question id, used to keep these out of "Your work". */
  targetId: string;
  title: string;
  /** Reason line. `emphasis` is shown with weight, never colour. */
  reason: { before: string; emphasis?: string; after?: string };
  action: { label: string; href: string };
};

export const getNeedsYou = cache(async (ctx: Ctx): Promise<NeedsYouItem[]> => {
  const { db, user } = ctx;
  const t = now();

  const [approvals, claimed, asked, shareAsks, checkIns, publishing, toVerify, liveOwned, invites] = await Promise.all([
    // Approvals waiting on them (never their own ideas), soonest deadline first.
    db.project.findMany({
      where: {
        stage: "APPROVAL",
        ownerId: { not: user.id },
        approvals: { none: { userId: user.id } },
        OR: [{ approverIds: { has: user.id } }, ...(user.isAdmin ? [{ approverIds: { isEmpty: true } }, { escalatedAt: { not: null } }] : [])],
      },
      orderBy: [{ autoApproveAt: { sort: "asc", nulls: "last" } }, { submittedAt: "asc" }],
      select: { id: true, title: true, autoApproveAt: true, approvalsNeeded: true, _count: { select: { approvals: true } } },
    }),
    // Questions they claimed where the asker spoke last.
    db.question.findMany({
      where: { status: "IN_PROGRESS", claimerId: user.id },
      include: { asker: true, messages: { orderBy: [{ sentAt: "desc" }, { createdAt: "desc" }], take: 1, select: { authorId: true, sentAt: true } } },
    }),
    // Their own questions where the Champion replied last.
    db.question.findMany({
      where: { status: "IN_PROGRESS", askerId: user.id },
      include: { claimer: true, messages: { orderBy: [{ sentAt: "desc" }, { createdAt: "desc" }], take: 1, select: { authorId: true, sentAt: true } } },
    }),
    // A Champion suggested sharing the answer to their question.
    db.question.findMany({ where: { askerId: user.id, status: "RESOLVED", sharedAt: null, answerSummary: { not: null } }, select: { id: true, title: true } }),
    // Check-ins due on initiatives they own.
    db.project.findMany({ where: { ownerId: user.id, stage: "BUILDING", nextCheckInAt: { lte: t } }, select: { id: true, title: true, nextCheckInAt: true } }),
    db.project.findMany({ where: { stage: "PUBLISHING", publisherId: user.id }, orderBy: { publishingAssignedAt: "asc" }, select: { id: true, title: true } }),
    // Outcomes to verify: admins, and approvers of the initiative, never on the team or the reporter.
    db.impactLog.findMany({
      where: {
        verifiedAt: null,
        evidence: { not: null },
        reportedById: { not: user.id },
        project: { orgId: ctx.org.id, team: { none: { userId: user.id } }, ...(user.isAdmin ? {} : { approvedById: user.id }) },
      },
      include: { project: { select: { id: true, title: true } } },
      take: 10,
    }),
    // Late in the month: Live initiatives they own with no outcome reported yet.
    zonedParts(t).day >= 20
      ? db.project.findMany({ where: { ownerId: user.id, stage: "LIVE", impact: { none: { month: startOfMonth(t) } } }, select: { id: true, title: true } })
      : Promise.resolve([]),
    db.projectInvite.findMany({
      where: { userId: user.id, status: "PENDING", project: { orgId: ctx.org.id, stage: { not: "LIVE" } } },
      include: { project: { select: { id: true, title: true } } },
      orderBy: { createdAt: "asc" },
    }),
  ]);
  const inviters = await db.user.findMany({ where: { id: { in: invites.map((i) => i.invitedById) } }, select: { id: true, name: true } });

  const waitingOnMe = claimed.filter((q) => !q.messages[0] || q.messages[0].authorId === q.askerId);
  const repliedToMe = asked.filter((q) => q.messages[0] && q.messages[0].authorId === q.claimerId);

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
          : { before: "Waiting for your decision" },
      action: { label: "Review", href: `/ideas/${p.id}/approve` },
    })),
    ...waitingOnMe.map((q) => ({
      key: `question-${q.id}`,
      kind: "question" as const,
      targetId: q.id,
      title: q.title,
      reason: { before: `${q.isAnonymous ? "The asker" : q.asker.name} is waiting on your reply` },
      action: { label: "Reply", href: `/help-desk/${q.id}` },
    })),
    ...checkIns.map((p) => ({
      key: `checkin-${p.id}`,
      kind: "checkin" as const,
      targetId: p.id,
      title: p.title,
      reason: { before: "Check-in due. On track, at risk or blocked?" },
      action: { label: "Check in", href: `/ideas/${p.id}?tab=checkins` },
    })),
    ...repliedToMe.map((q) => ({
      key: `answer-${q.id}`,
      kind: "answer" as const,
      targetId: q.id,
      title: q.title,
      reason: { before: `${q.claimer?.name ?? "Your Champion"} replied to your question` },
      action: { label: "Read", href: `/help-desk/${q.id}` },
    })),
    ...publishing.map((p) => ({
      key: `publishing-${p.id}`,
      kind: "publishing" as const,
      targetId: p.id,
      title: p.title,
      reason: { before: "Ready for you to launch" },
      action: { label: "Open", href: `/ideas/${p.id}` },
    })),
    ...toVerify.map((i) => ({
      key: `verify-${i.id}`,
      kind: "verify" as const,
      targetId: i.project.id,
      title: i.project.title,
      reason: { before: "Reported ", emphasis: `${i.hoursSaved} hours saved`, after: ". Check the evidence and verify it" },
      action: { label: "Verify", href: `/ideas/${i.project.id}?tab=outcomes` },
    })),
    ...liveOwned.map((p) => ({
      key: `outcome-${p.id}`,
      kind: "outcome" as const,
      targetId: p.id,
      title: p.title,
      reason: { before: "Report this month's outcome so leadership can count it" },
      action: { label: "Report", href: `/ideas/${p.id}?tab=outcomes` },
    })),
    ...shareAsks.map((q) => ({
      key: `share-${q.id}`,
      kind: "share" as const,
      targetId: q.id,
      title: q.title,
      reason: { before: "Your Champion suggested sharing the answer. Nothing is shared unless you agree" },
      action: { label: "Decide", href: `/help-desk/${q.id}` },
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
