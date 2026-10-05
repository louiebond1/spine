"use server";

import { revalidatePath } from "next/cache";
import { scanOpportunities } from "../ai/opportunities";
import { now } from "../clock";
import { db } from "../db";
import { assert, can } from "../permissions";
import { getSettings } from "../settings";
import { getCurrentUser } from "../session";

const DAY = 86_400_000;

/** Runs the "Spotted by Spine" scan at most once a day (or on demand for admins). */
export async function refreshOpportunities(force = false): Promise<{ ok: boolean; created: number }> {
  const user = await getCurrentUser();
  if (force) assert(can.manage(user), "Only admins can rescan.");
  const settings = await getSettings();
  if (!force && settings.opportunitiesScannedAt && now().getTime() - settings.opportunitiesScannedAt.getTime() < DAY) return { ok: true, created: 0 };
  try {
    const created = await scanOpportunities();
    if (created) revalidatePath("/ideas");
    return { ok: true, created };
  } catch {
    return { ok: false, created: 0 };
  }
}

export async function dismissOpportunity(id: string) {
  const user = await getCurrentUser();
  assert(can.manage(user), "Only admins can dismiss suggestions.");
  await db.opportunity.update({ where: { id }, data: { status: "DISMISSED" } });
  revalidatePath("/ideas");
}
