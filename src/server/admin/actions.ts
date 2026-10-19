"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { now } from "../clock";
import { requireCtx, type Ctx } from "../ctx";
import { assert, can } from "../permissions";
import { audit } from "../audit";
import { encrypt, encryptionReady } from "../crypto";
import { postToChannels, webhookProblem } from "../integrations/channels";

// Admin actions. Every one checks the admin role on the server, works only inside the admin's
// organisation and is written to the audit log.

async function requireAdmin(): Promise<Ctx> {
  const ctx = await requireCtx();
  assert(can.manage(ctx.user), "Only admins can change settings.");
  return ctx;
}

type Result = { error?: string; saved?: boolean; message?: string };

const rulesSchema = z.object({
  approvalTimeoutDays: z.coerce.number().int().min(1).max(60),
  approvalNudgeDays: z.coerce.number().int().min(1).max(60),
  approvalEscalateDays: z.coerce.number().int().min(1).max(90),
  stalledBuildDays: z.coerce.number().int().min(1).max(90),
  unclaimedQuestionHours: z.coerce.number().int().min(1).max(168),
  digestTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  digestWeekdaysOnly: z.boolean(),
});

export async function saveRules(input: z.input<typeof rulesSchema>): Promise<Result> {
  const ctx = await requireAdmin();
  const parsed = rulesSchema.safeParse(input);
  if (!parsed.success) return { error: "Use whole numbers above zero." };
  await ctx.db.settings.update({ where: { orgId: ctx.org.id }, data: parsed.data });
  await audit(ctx, "settings.rules_changed", "Settings", null, JSON.stringify(parsed.data));
  revalidatePath("/", "layout");
  return { saved: true };
}

const orgSchema = z.object({
  name: z.string().trim().min(2, "Name your organisation.").max(80),
  allowedEmailDomain: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^$|^[a-z0-9.-]+\.[a-z]{2,}$/, "Use a domain like example.com, or leave it empty."),
  aiMonthlyLimit: z.coerce.number().int().min(0).max(100000),
});

export async function saveOrganisation(input: z.input<typeof orgSchema>): Promise<Result> {
  const ctx = await requireAdmin();
  const parsed = orgSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form." };
  await ctx.db.$transaction(async (tx) => {
    await tx.organization.update({ where: { id: ctx.org.id }, data: { name: parsed.data.name } });
    await tx.settings.update({ where: { orgId: ctx.org.id }, data: { allowedEmailDomain: parsed.data.allowedEmailDomain || null, aiMonthlyLimit: parsed.data.aiMonthlyLimit } });
  });
  await audit(ctx, "organisation.updated", "Organization", ctx.org.id, `${parsed.data.name}; AI limit ${parsed.data.aiMonthlyLimit}; domain ${parsed.data.allowedEmailDomain || "any"}`);
  revalidatePath("/", "layout");
  return { saved: true };
}

const topicName = z.string().trim().min(2).max(40);

export async function addTopic(name: string): Promise<Result> {
  const ctx = await requireAdmin();
  const parsed = topicName.safeParse(name);
  if (!parsed.success) return { error: "Topic names are 2 to 40 characters." };
  const existing = await ctx.db.topic.findFirst({ where: { name: parsed.data } });
  if (existing && !existing.archivedAt) return { error: "That topic already exists." };
  if (existing) await ctx.db.topic.update({ where: { id: existing.id }, data: { archivedAt: null } });
  else await ctx.db.topic.create({ data: { orgId: ctx.org.id, name: parsed.data } });
  await audit(ctx, "topic.added", "Topic", existing?.id ?? null, parsed.data);
  revalidatePath("/", "layout");
  return { saved: true };
}

export async function renameTopic(id: string, name: string): Promise<Result> {
  const ctx = await requireAdmin();
  const parsed = topicName.safeParse(name);
  if (!parsed.success) return { error: "Topic names are 2 to 40 characters." };
  const clash = await ctx.db.topic.findFirst({ where: { name: parsed.data, id: { not: id } } });
  if (clash) return { error: "That topic already exists." };
  await ctx.db.topic.update({ where: { id }, data: { name: parsed.data } });
  await audit(ctx, "topic.renamed", "Topic", id, parsed.data);
  revalidatePath("/", "layout");
  return { saved: true };
}

/** Removing archives the topic: gone from pickers, still shown on old questions and initiatives. */
export async function removeTopic(id: string): Promise<Result> {
  const ctx = await requireAdmin();
  await ctx.db.topic.update({ where: { id }, data: { archivedAt: now() } });
  await audit(ctx, "topic.removed", "Topic", id);
  revalidatePath("/", "layout");
  return { saved: true };
}

const money = z.union([z.literal(""), z.coerce.number().min(0).max(100_000_000)]);

export async function saveImpact(input: { hourlyCost: string; programmeCost: string }): Promise<Result> {
  const ctx = await requireAdmin();
  const hourly = money.safeParse(input.hourlyCost.trim());
  const programme = money.safeParse(input.programmeCost.trim());
  if (!hourly.success || !programme.success) return { error: "Enter amounts as numbers, or leave them empty." };
  const data = { hourlyCost: hourly.data === "" ? null : hourly.data, programmeCost: programme.data === "" ? null : programme.data };
  await ctx.db.settings.update({ where: { orgId: ctx.org.id }, data });
  await audit(ctx, "settings.impact_changed", "Settings", null);
  revalidatePath("/", "layout");
  return { saved: true };
}

// ---------------------------------------------------------------------------
// Integrations: one Slack incoming webhook and one Teams Workflows webhook per organisation.
// URLs are secrets: stored encrypted, never sent back to the browser.
// ---------------------------------------------------------------------------

export async function saveWebhook(kind: "slack" | "teams", url: string): Promise<Result> {
  const ctx = await requireAdmin();
  if (!encryptionReady()) return { error: "Set SPINE_ENCRYPTION_KEY on the server before connecting channels." };
  const problem = webhookProblem(kind, url);
  if (problem) return { error: problem };
  const field = kind === "slack" ? { slackWebhookEnc: encrypt(url.trim()), slackLastStatus: null, slackLastAt: null } : { teamsWebhookEnc: encrypt(url.trim()), teamsLastStatus: null, teamsLastAt: null };
  await ctx.db.settings.update({ where: { orgId: ctx.org.id }, data: field });
  await audit(ctx, `integration.${kind}_connected`, "Settings", null);
  revalidatePath("/admin");
  return { saved: true };
}

export async function removeWebhook(kind: "slack" | "teams"): Promise<Result> {
  const ctx = await requireAdmin();
  const field = kind === "slack" ? { slackWebhookEnc: null, slackLastStatus: null, slackLastAt: null } : { teamsWebhookEnc: null, teamsLastStatus: null, teamsLastAt: null };
  await ctx.db.settings.update({ where: { orgId: ctx.org.id }, data: field });
  await audit(ctx, `integration.${kind}_disconnected`, "Settings", null);
  revalidatePath("/admin");
  return { saved: true };
}

/** Sends a test message to the connected channels and reports exactly what happened. */
export async function testChannels(): Promise<Result> {
  const ctx = await requireAdmin();
  const r = await postToChannels(ctx.db, ctx.org.id, { title: "Spine is connected", text: `${ctx.user.name} sent this test from Admin > Integrations. Approvals, blockers and the daily Pulse digest will appear here.`, href: "/pulse" });
  revalidatePath("/admin");
  if (!r.slack && !r.teams) return { error: "No channel is connected yet." };
  const parts = [r.slack && `Slack: ${r.slack === "ok" ? "delivered" : r.slack}`, r.teams && `Teams: ${r.teams === "ok" ? "delivered" : r.teams}`].filter(Boolean);
  return { message: parts.join(" · ") };
}
