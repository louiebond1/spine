import "server-only";
import { plural } from "@/lib/format";
import { now } from "../clock";
import { db } from "../db";
import { notify } from "../notify/notify";
import { currentApprovers } from "../notify/events";
import { logEvent, systemMessage } from "../projects/lifecycle";
import { getSettings } from "../settings";

// Chasing stuck approvals (runs in the scheduled job). After approvalNudgeDays Spine reminds
// whoever still has to approve. After approvalEscalateDays, if the rule named approvers, any
// admin can decide too, and the admins are told. Each step happens once per approval round.

const DAY = 86_400_000;

export async function chaseApprovals(): Promise<{ nudged: number; escalated: number }> {
  const s = await getSettings();
  const t = now();
  const rows = await db.project.findMany({ where: { stage: "APPROVAL" }, select: { id: true, title: true, submittedAt: true, buildCompletedAt: true, approvalNudgedAt: true, escalatedAt: true, approverIds: true, autoApproveAt: true } });
  let nudged = 0;
  let escalated = 0;
  for (const p of rows) {
    const since = p.buildCompletedAt ?? p.submittedAt;
    if (!since) continue;
    const days = (t.getTime() - since.getTime()) / DAY;
    const href = `/ideas/${p.id}/approve`;

    if (!p.approvalNudgedAt && days >= s.approvalNudgeDays) {
      const ids = await currentApprovers(p.id);
      const auto = p.autoApproveAt ? " It auto-approves soon if nobody decides." : "";
      await notify(ids, { kind: "nudge", title: `Still waiting: ${p.title}`, body: `This idea has waited ${plural(Math.floor(days), "day")} for your approval.${auto}`, href });
      await db.$transaction(async (tx) => {
        await tx.project.update({ where: { id: p.id }, data: { approvalNudgedAt: t } });
        await logEvent(tx, p.id, "APPROVAL_NUDGED", null);
      });
      nudged++;
    }

    if (!p.escalatedAt && p.approverIds.length > 0 && !p.autoApproveAt && days >= s.approvalEscalateDays) {
      await db.$transaction(async (tx) => {
        await tx.project.update({ where: { id: p.id }, data: { escalatedAt: t } });
        await logEvent(tx, p.id, "APPROVAL_ESCALATED", null);
        await systemMessage(tx, p.id, `Approval has waited ${plural(Math.floor(days), "day")}, so any admin can now decide`);
      });
      const admins = (await db.user.findMany({ where: { isAdmin: true }, select: { id: true } })).map((u) => u.id);
      await notify(admins, { kind: "nudge", title: `Escalated: ${p.title} needs a decision`, body: `The named approvers haven't decided after ${plural(Math.floor(days), "day")}. Any admin can approve or return it now.`, href });
      escalated++;
    }
  }
  return { nudged, escalated };
}
