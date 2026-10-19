"use server";

import type { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { NOTIFY_KINDS, readPreferences } from "@/lib/preferences";
import { requireCtx } from "./ctx";

const input = z.object({
  name: z.string().trim().min(2, "Add your name.").max(80),
  slackUserId: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^$|^[UW][A-Z0-9]{2,20}$/, "Slack member IDs look like U012AB3CD (Slack profile > More > Copy member ID)."),
  emailKinds: z.record(z.string(), z.boolean()),
});

/** Settings for the signed-in person only: name, Slack identity and which emails they get. */
export async function savePreferences(raw: unknown): Promise<{ ok: true } | { ok: false; error: string }> {
  const { db, user } = await requireCtx();
  const parsed = input.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check your settings." };
  const d = parsed.data;
  const email = Object.fromEntries(Object.keys(NOTIFY_KINDS).map((k) => [k, d.emailKinds[k] !== false]));
  const prefs = { ...readPreferences(user.preferences), email };
  const initials = d.name.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  await db.user.update({ where: { id: user.id }, data: { name: d.name, initials, slackUserId: d.slackUserId || null, preferences: prefs as unknown as Prisma.InputJsonValue } });
  revalidatePath("/", "layout");
  return { ok: true };
}
