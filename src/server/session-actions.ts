"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { db } from "./db";
import { SESSION_COOKIE } from "./session";

export async function switchUser(userId: string) {
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error("Unknown user");
  (await cookies()).set(SESSION_COOKIE, user.id, { httpOnly: true, sameSite: "lax", path: "/" });
  revalidatePath("/", "layout");
}
