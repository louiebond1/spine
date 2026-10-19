"use server";

import { revalidatePath } from "next/cache";
import { now } from "../clock";
import { requireCtx } from "../ctx";

export async function markUpdatesRead() {
  const { db, user } = await requireCtx();
  await db.notification.updateMany({ where: { userId: user.id, readAt: null }, data: { readAt: now() } });
  revalidatePath("/", "layout");
}
