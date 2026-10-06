"use server";

import type { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ACCENTS, NOTIFY_KINDS, SIZES, THEMES, readPreferences } from "@/lib/preferences";
import { db } from "./db";
import { getCurrentUser } from "./session";

const input = z.object({
  theme: z.enum(THEMES),
  accent: z.enum(ACCENTS),
  size: z.enum(SIZES),
  email: z.string().trim().max(200).email("That email address doesn't look right.").or(z.literal("")),
  emailKinds: z.record(z.string(), z.boolean()),
});

/** Your settings: appearance and notifications for the signed-in person only. */
export async function savePreferences(raw: unknown): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await getCurrentUser();
  const parsed = input.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check your settings." };
  const d = parsed.data;
  const email = Object.fromEntries(Object.keys(NOTIFY_KINDS).map((k) => [k, d.emailKinds[k] !== false]));
  const prefs = { ...readPreferences(user.preferences), theme: d.theme, accent: d.accent, size: d.size, email };
  await db.user.update({ where: { id: user.id }, data: { email: d.email || null, preferences: prefs as unknown as Prisma.InputJsonValue } });
  revalidatePath("/", "layout");
  return { ok: true };
}
