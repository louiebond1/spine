"use server";

import { revalidatePath } from "next/cache";
import { now } from "../clock";
import { db } from "../db";
import { getCurrentUser } from "../session";

export async function markUpdatesRead() {
  const user = await getCurrentUser();
  await db.notification.updateMany({ where: { userId: user.id, readAt: null }, data: { readAt: now() } });
  revalidatePath("/", "layout");
}
