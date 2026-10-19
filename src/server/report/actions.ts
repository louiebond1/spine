"use server";

import { revalidatePath } from "next/cache";
import { requireCtx } from "../ctx";
import { assert, can } from "../permissions";
import { getReport } from "./report";

export async function rewriteReport(month: string): Promise<{ ok: boolean }> {
  const ctx = await requireCtx();
  assert(can.manage(ctx.user), "Only admins can rewrite the report.");
  if (!/^\d{4}-\d{2}$/.test(month)) return { ok: false };
  const r = await getReport(ctx, month, { refresh: true });
  revalidatePath("/leadership/report");
  return { ok: !r.aiError };
}
