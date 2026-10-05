import "server-only";
import { cache } from "react";
import { plural } from "@/lib/format";
import { now } from "../clock";
import { db } from "../db";
import { getSettings } from "../settings";

// CLAUDE.md section 7, Pulse. Recalculated on every request; nothing is stored.

/**
 * "latest-per-check": at most one item per check, the one that crossed its threshold most
 * recently. Switch to "all" to show every item (a product decision that may change).
 */
export type PulseMode = "latest-per-check" | "all";
export const PULSE_MODE = "latest-per-check" as PulseMode;

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

export type PulseCheck = "approval" | "question" | "build";

export type PulseItem = {
  key: string;
  check: PulseCheck;
  targetId: string;
  title: string;
  reason: string;
  action: { label: "Review" | "Claim" | "Open"; href: string };
  crossedAt: Date;
};

/** Approval nearing timeout: in Approval with less than 24 hours until autoApproveAt. */
async function approvalsNearTimeout(t: Date): Promise<PulseItem[]> {
  const rows = await db.project.findMany({
    where: { stage: "APPROVAL", autoApproveAt: { gt: t, lt: new Date(t.getTime() + DAY) } },
    select: { id: true, title: true, autoApproveAt: true },
  });
  return rows.map((p) => {
    const hours = Math.max(1, Math.ceil((p.autoApproveAt!.getTime() - t.getTime()) / HOUR));
    return {
      key: `approval-${p.id}`,
      check: "approval",
      targetId: p.id,
      title: p.title,
      reason: `Approval auto-approves in ${plural(hours, "hour")} unless someone reviews it`,
      action: { label: "Review", href: `/ideas/${p.id}/approve` },
      crossedAt: new Date(p.autoApproveAt!.getTime() - DAY),
    };
  });
}

/** Unanswered question: unclaimed for longer than unclaimedQuestionHours. */
async function unclaimedQuestions(t: Date, thresholdHours: number): Promise<PulseItem[]> {
  const rows = await db.question.findMany({
    where: { status: "UNCLAIMED", postedAt: { lt: new Date(t.getTime() - thresholdHours * HOUR) } },
    select: { id: true, title: true, postedAt: true, isAnonymous: true, asker: { select: { name: true } } },
  });
  return rows.map((q) => {
    const age = t.getTime() - q.postedAt.getTime();
    const ageText = age < DAY ? plural(Math.floor(age / HOUR), "hour") : plural(Math.floor(age / DAY), "day");
    const who = q.isAnonymous ? "Anonymous" : q.asker.name;
    return {
      key: `question-${q.id}`,
      check: "question",
      targetId: q.id,
      title: q.title,
      reason: `${who} asked ${ageText} ago and no Champion has claimed it`,
      action: { label: "Claim", href: `/help-desk/${q.id}` },
      crossedAt: new Date(q.postedAt.getTime() + thresholdHours * HOUR),
    };
  });
}

/** Build going quiet: in Building with no activity for longer than stalledBuildDays. */
async function quietBuilds(t: Date, thresholdDays: number): Promise<PulseItem[]> {
  const rows = await db.project.findMany({
    where: { stage: "BUILDING", lastActivityAt: { lt: new Date(t.getTime() - thresholdDays * DAY) } },
    select: { id: true, title: true, lastActivityAt: true, owner: { select: { name: true } } },
  });
  return rows.map((p) => ({
    key: `build-${p.id}`,
    check: "build",
    targetId: p.id,
    title: p.title,
    reason: `${p.owner.name}’s build has had no activity for ${plural(Math.floor((t.getTime() - p.lastActivityAt.getTime()) / DAY), "day")}`,
    action: { label: "Open", href: `/ideas/${p.id}` },
    crossedAt: new Date(p.lastActivityAt.getTime() + thresholdDays * DAY),
  }));
}

/** Every hit of each check, before the one-per-check rule. Used by Programme's big flags too. */
export async function getAllPulseHits() {
  const t = now();
  const settings = await getSettings();
  const [approval, question, build] = await Promise.all([
    approvalsNearTimeout(t),
    unclaimedQuestions(t, settings.unclaimedQuestionHours),
    quietBuilds(t, settings.stalledBuildDays),
  ]);
  return { approval, question, build };
}

export const getPulseItems = cache(async (mode: PulseMode = PULSE_MODE): Promise<PulseItem[]> => {
  const hits = await getAllPulseHits();
  const byRecency = (items: PulseItem[]) => [...items].sort((a, b) => b.crossedAt.getTime() - a.crossedAt.getTime());
  return (["approval", "question", "build"] as const).flatMap((check) =>
    mode === "all" ? byRecency(hits[check]) : byRecency(hits[check]).slice(0, 1),
  );
});
