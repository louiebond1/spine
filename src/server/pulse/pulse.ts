import "server-only";
import { plural } from "@/lib/format";
import { now } from "../clock";
import type { Scope } from "../ctx";
import { getSettings } from "../settings";

// Pulse: anything going quiet, recalculated on every request (nothing stored). It's the
// momentum view for Champions and admins, and the daily channel digest.

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
/** Each check shows its most recent items first, capped so Pulse stays a short list. */
export const PER_CHECK_LIMIT = 5;

export type PulseCheck = "blocked" | "approval" | "question" | "checkin" | "overdue" | "build" | "outcome";

export const CHECK_LABEL: Record<PulseCheck, string> = {
  blocked: "Blocked",
  approval: "Decisions waiting",
  question: "Unanswered questions",
  checkin: "Missed check-ins",
  overdue: "Overdue steps",
  build: "Gone quiet",
  outcome: "Outcomes to verify",
};

export type PulseItem = {
  key: string;
  check: PulseCheck;
  targetId: string;
  title: string;
  reason: string;
  action: { label: string; href: string };
  crossedAt: Date;
};

const days = (ms: number) => plural(Math.max(1, Math.floor(ms / DAY)), "day");

export async function getAllPulseHits(scope: Scope): Promise<PulseItem[]> {
  const { db } = scope;
  const t = now();
  const s = await getSettings(scope);
  const [nearTimeout, stuck, unclaimed, quiet, blocked, missed, overdue, unverified] = await Promise.all([
    db.project.findMany({ where: { stage: "APPROVAL", autoApproveAt: { gt: t, lt: new Date(t.getTime() + DAY) } }, select: { id: true, title: true, autoApproveAt: true } }),
    db.project.findMany({ where: { stage: "APPROVAL", autoApproveAt: null }, select: { id: true, title: true, submittedAt: true, buildCompletedAt: true, escalatedAt: true } }),
    db.question.findMany({ where: { status: "UNCLAIMED", postedAt: { lt: new Date(t.getTime() - s.unclaimedQuestionHours * HOUR) } }, select: { id: true, title: true, postedAt: true } }),
    db.project.findMany({ where: { stage: "BUILDING", blockedAt: null, lastActivityAt: { lt: new Date(t.getTime() - s.stalledBuildDays * DAY) } }, select: { id: true, title: true, lastActivityAt: true, owner: { select: { name: true } } } }),
    db.project.findMany({ where: { blockedAt: { not: null }, stage: { in: ["BUILDING", "PUBLISHING"] } }, select: { id: true, title: true, blockedAt: true, blockerNote: true } }),
    db.project.findMany({ where: { stage: "BUILDING", blockedAt: null, nextCheckInAt: { lt: new Date(t.getTime() - 2 * DAY) } }, select: { id: true, title: true, nextCheckInAt: true, owner: { select: { name: true } } } }),
    db.project.findMany({
      where: { stage: "BUILDING", steps: { some: { done: false, dueDate: { lt: new Date(t.getTime() - DAY) } } } },
      select: { id: true, title: true, steps: { where: { done: false, dueDate: { lt: new Date(t.getTime() - DAY) } }, select: { dueDate: true } } },
    }),
    db.impactLog.findMany({
      where: { verifiedAt: null, evidence: { not: null }, updatedAt: { lt: new Date(t.getTime() - 7 * DAY) }, project: { orgId: scope.org.id } },
      select: { id: true, hoursSaved: true, updatedAt: true, project: { select: { id: true, title: true } } },
    }),
  ]);

  const items: PulseItem[] = [
    ...blocked.map((p) => ({
      key: `blocked-${p.id}`,
      check: "blocked" as const,
      targetId: p.id,
      title: p.title,
      reason: `Blocked for ${days(t.getTime() - p.blockedAt!.getTime())}: ${(p.blockerNote ?? "").slice(0, 140)}`,
      action: { label: "Open", href: `/ideas/${p.id}?tab=checkins` },
      crossedAt: p.blockedAt!,
    })),
    ...nearTimeout.map((p) => ({
      key: `approval-${p.id}`,
      check: "approval" as const,
      targetId: p.id,
      title: p.title,
      reason: `Auto-approves in ${plural(Math.max(1, Math.ceil((p.autoApproveAt!.getTime() - t.getTime()) / HOUR)), "hour")} unless someone reviews it`,
      action: { label: "Review", href: `/ideas/${p.id}/approve` },
      crossedAt: new Date(p.autoApproveAt!.getTime() - DAY),
    })),
    ...stuck.flatMap((p) => {
      const since = p.buildCompletedAt ?? p.submittedAt;
      if (!since || t.getTime() - since.getTime() < s.approvalNudgeDays * DAY) return [];
      return [
        {
          key: `approval-${p.id}`,
          check: "approval" as const,
          targetId: p.id,
          title: p.title,
          reason: `Waiting ${days(t.getTime() - since.getTime())} for a decision${p.escalatedAt ? ", now open to any admin" : ""}`,
          action: { label: "Review", href: `/ideas/${p.id}/approve` },
          crossedAt: new Date(since.getTime() + s.approvalNudgeDays * DAY),
        },
      ];
    }),
    ...unclaimed.map((q) => {
      const age = t.getTime() - q.postedAt.getTime();
      return {
        key: `question-${q.id}`,
        check: "question" as const,
        targetId: q.id,
        title: q.title,
        reason: `Asked ${age < DAY ? plural(Math.floor(age / HOUR), "hour") : days(age)} ago and no Champion has claimed it`,
        action: { label: "Claim", href: `/help-desk/${q.id}` },
        crossedAt: new Date(q.postedAt.getTime() + s.unclaimedQuestionHours * HOUR),
      };
    }),
    ...missed.map((p) => ({
      key: `checkin-${p.id}`,
      check: "checkin" as const,
      targetId: p.id,
      title: p.title,
      reason: `${p.owner.name}'s check-in is ${days(t.getTime() - p.nextCheckInAt!.getTime())} overdue`,
      action: { label: "Open", href: `/ideas/${p.id}?tab=checkins` },
      crossedAt: p.nextCheckInAt!,
    })),
    ...overdue.map((p) => {
      const oldest = p.steps.reduce((m, st) => (st.dueDate < m ? st.dueDate : m), p.steps[0]!.dueDate);
      return {
        key: `overdue-${p.id}`,
        check: "overdue" as const,
        targetId: p.id,
        title: p.title,
        reason: `${plural(p.steps.length, "step")} past due, the oldest by ${days(t.getTime() - oldest.getTime())}`,
        action: { label: "Open", href: `/ideas/${p.id}` },
        crossedAt: new Date(oldest.getTime() + DAY),
      };
    }),
    ...quiet.map((p) => ({
      key: `build-${p.id}`,
      check: "build" as const,
      targetId: p.id,
      title: p.title,
      reason: `${p.owner.name}'s build has had no activity for ${days(t.getTime() - p.lastActivityAt.getTime())}`,
      action: { label: "Open", href: `/ideas/${p.id}` },
      crossedAt: new Date(p.lastActivityAt.getTime() + s.stalledBuildDays * DAY),
    })),
    ...unverified.map((i) => ({
      key: `outcome-${i.id}`,
      check: "outcome" as const,
      targetId: i.project.id,
      title: i.project.title,
      reason: `${i.hoursSaved} hours saved reported ${days(t.getTime() - i.updatedAt.getTime())} ago and not yet verified`,
      action: { label: "Verify", href: `/ideas/${i.project.id}?tab=outcomes` },
      crossedAt: new Date(i.updatedAt.getTime() + 7 * DAY),
    })),
  ];
  return items;
}

/** Grouped by check in a fixed order, most recently crossed first, capped per check. */
export async function getPulse(scope: Scope): Promise<{ check: PulseCheck; items: PulseItem[]; total: number }[]> {
  const hits = await getAllPulseHits(scope);
  const order: PulseCheck[] = ["blocked", "approval", "question", "checkin", "overdue", "build", "outcome"];
  return order
    .map((check) => {
      const all = hits.filter((h) => h.check === check).sort((a, b) => b.crossedAt.getTime() - a.crossedAt.getTime());
      return { check, items: all.slice(0, PER_CHECK_LIMIT), total: all.length };
    })
    .filter((g) => g.total > 0);
}

export async function pulseCount(scope: Scope) {
  return (await getAllPulseHits(scope)).length;
}
