"use server";

import { revalidatePath } from "next/cache";
import { scanOpportunities } from "../ai/opportunities";
import { now } from "../clock";
import { requireCtx } from "../ctx";
import { assert, can } from "../permissions";
import { getSettings } from "../settings";

const DAY = 86_400_000;

/** "Spotted by Spine" scan: at most once a day, or on demand for admins. */
export async function refreshOpportunities(force = false): Promise<{ ok: boolean; created: number }> {
  const ctx = await requireCtx();
  assert(can.seeQueue(ctx.user), "Only Champions and admins see opportunities.");
  if (force) assert(can.manage(ctx.user), "Only admins can rescan.");
  const settings = await getSettings(ctx);
  if (!force && settings.opportunitiesScannedAt && now().getTime() - settings.opportunitiesScannedAt.getTime() < DAY) return { ok: true, created: 0 };
  try {
    const created = await scanOpportunities(ctx);
    if (created) revalidatePath("/discover");
    return { ok: true, created };
  } catch {
    return { ok: false, created: 0 };
  }
}

export async function dismissOpportunity(id: string) {
  const ctx = await requireCtx();
  assert(can.seeQueue(ctx.user), "Only Champions and admins can dismiss suggestions.");
  await ctx.db.opportunity.update({ where: { id }, data: { status: "DISMISSED" } });
  revalidatePath("/discover");
}
