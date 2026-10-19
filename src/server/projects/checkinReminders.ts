import "server-only";
import { now } from "../clock";
import type { Scope } from "../ctx";
import { checkInDue } from "../notify/events";

/** Reminds owners once per due check-in (the scheduled job calls this). */
export async function remindDueCheckIns(scope: Scope): Promise<number> {
  const due = await scope.db.project.findMany({ where: { stage: "BUILDING", nextCheckInAt: { lte: now() } }, select: { id: true, ownerId: true, nextCheckInAt: true } });
  let sent = 0;
  for (const p of due) {
    const already = await scope.db.notification.findFirst({ where: { userId: p.ownerId, kind: "checkin", href: `/ideas/${p.id}?tab=checkins`, at: { gte: p.nextCheckInAt! } } });
    if (already) continue;
    await checkInDue(scope, p.id);
    sent++;
  }
  return sent;
}
