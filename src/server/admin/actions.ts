"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { now } from "../clock";
import { db } from "../db";
import { assert, can } from "../permissions";
import { getCurrentUser } from "../session";
import { assignUnassignedPublishing } from "../projects/lifecycle";

// Admin tab actions. Every one checks the admin role on the server.

async function requireAdmin() {
  const user = await getCurrentUser();
  assert(can.manage(user), "Only admins can change settings.");
  return user;
}

type Result = { error?: string; saved?: boolean };

const rulesSchema = z.object({
  approvalTimeoutDays: z.coerce.number().int().min(1).max(60),
  stalledBuildDays: z.coerce.number().int().min(1).max(90),
  unclaimedQuestionHours: z.coerce.number().int().min(1).max(168),
  digestChannel: z.literal("Slack"),
  digestTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
});

export async function saveRules(input: z.input<typeof rulesSchema>): Promise<Result> {
  await requireAdmin();
  const parsed = rulesSchema.safeParse(input);
  if (!parsed.success) return { error: "Use whole numbers above zero." };
  await db.settings.upsert({ where: { id: "singleton" }, create: { id: "singleton", ...parsed.data }, update: parsed.data });
  revalidatePath("/", "layout");
  return { saved: true };
}

const rolesSchema = z.array(
  z.object({ id: z.string(), isChampion: z.boolean(), isAdmin: z.boolean(), isPublishingSpecialist: z.boolean() }),
);

export async function saveRoles(input: z.input<typeof rolesSchema>): Promise<Result> {
  await requireAdmin();
  const parsed = rolesSchema.safeParse(input);
  if (!parsed.success) return { error: "Something didn't look right. Try again." };
  if (!parsed.data.some((u) => u.isAdmin)) return { error: "Keep at least one admin." };
  await db.$transaction(
    parsed.data.map(({ id, ...roles }) => db.user.update({ where: { id }, data: roles })),
  );
  await assignUnassignedPublishing();
  revalidatePath("/", "layout");
  return { saved: true };
}

const topicName = z.string().trim().min(2).max(40);

export async function addTopic(name: string): Promise<Result> {
  await requireAdmin();
  const parsed = topicName.safeParse(name);
  if (!parsed.success) return { error: "Topic names are 2 to 40 characters." };
  const existing = await db.topic.findUnique({ where: { name: parsed.data } });
  if (existing && !existing.archivedAt) return { error: "That topic already exists." };
  if (existing) await db.topic.update({ where: { id: existing.id }, data: { archivedAt: null } });
  else await db.topic.create({ data: { name: parsed.data } });
  revalidatePath("/", "layout");
  return { saved: true };
}

export async function renameTopic(id: string, name: string): Promise<Result> {
  await requireAdmin();
  const parsed = topicName.safeParse(name);
  if (!parsed.success) return { error: "Topic names are 2 to 40 characters." };
  const clash = await db.topic.findFirst({ where: { name: parsed.data, id: { not: id } } });
  if (clash) return { error: "That topic already exists." };
  await db.topic.update({ where: { id }, data: { name: parsed.data } });
  revalidatePath("/", "layout");
  return { saved: true };
}

/** Removing archives the topic: gone from pickers, still shown on old questions and projects (PLAN.md Q19). */
export async function removeTopic(id: string): Promise<Result> {
  await requireAdmin();
  await db.topic.update({ where: { id }, data: { archivedAt: now() } });
  revalidatePath("/", "layout");
  return { saved: true };
}

const money = z.union([z.literal(""), z.coerce.number().min(0).max(100_000_000)]);

export async function saveImpact(input: { hourlyCost: string; programmeCost: string }): Promise<Result> {
  await requireAdmin();
  const hourly = money.safeParse(input.hourlyCost.trim());
  const programme = money.safeParse(input.programmeCost.trim());
  if (!hourly.success || !programme.success) return { error: "Enter amounts as numbers, or leave them empty." };
  await db.settings.upsert({
    where: { id: "singleton" },
    create: { id: "singleton", hourlyCost: hourly.data === "" ? null : hourly.data, programmeCost: programme.data === "" ? null : programme.data },
    update: { hourlyCost: hourly.data === "" ? null : hourly.data, programmeCost: programme.data === "" ? null : programme.data },
  });
  revalidatePath("/", "layout");
  return { saved: true };
}
