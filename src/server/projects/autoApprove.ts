import "server-only";
import { now } from "../clock";
import type { Scope } from "../ctx";
import { approve } from "./lifecycle";

/**
 * Approves anything nobody acted on by autoApproveAt. Runs in the scheduled job only (never
 * during a page view), and is safe to run repeatedly.
 */
export async function runDueAutoApprovals(scope: Scope): Promise<number> {
  const due = await scope.db.project.findMany({ where: { stage: "APPROVAL", autoApproveAt: { lte: now() } }, select: { id: true } });
  let approved = 0;
  for (const p of due) {
    try {
      await approve(scope, p.id, null);
      approved++;
    } catch {
      // Another run approved it first.
    }
  }
  return approved;
}
