import "server-only";
import { now } from "../clock";
import { db } from "../db";
import { approve } from "./lifecycle";

/**
 * CLAUDE.md section 7, Ideas & Projects rule 7: approve anything nobody acted on by
 * autoApproveAt. Runs on every page load and in the daily job; safe to run repeatedly.
 */
export async function runDueAutoApprovals(): Promise<number> {
  const due = await db.project.findMany({
    where: { stage: "APPROVAL", autoApproveAt: { lte: now() } },
    select: { id: true },
  });
  let approved = 0;
  for (const p of due) {
    try {
      await approve(p.id, null);
      approved++;
    } catch {
      // Another request approved it first.
    }
  }
  return approved;
}
