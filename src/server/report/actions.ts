"use server";

import { revalidatePath } from "next/cache";
import { assert, can } from "../permissions";
import { getCurrentUser } from "../session";
import { getReport } from "./report";

export async function rewriteReport(month: string): Promise<{ ok: boolean }> {
  const user = await getCurrentUser();
  assert(can.manage(user), "Only admins can rewrite the report.");
  if (!/^\d{4}-\d{2}$/.test(month)) return { ok: false };
  try {
    await getReport(month, { refresh: true });
  } catch (error) {
    console.error("[report] rewrite failed", error);
    return { ok: false };
  }
  revalidatePath("/programme/report");
  return { ok: true };
}
