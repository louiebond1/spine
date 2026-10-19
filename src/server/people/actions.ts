"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { rootDb } from "../db";
import { audit } from "../audit";
import { requireCtx, type Ctx } from "../ctx";
import { assert, can } from "../permissions";
import { issueInvitation } from "../auth/invitations";
import { destroyAllSessions } from "../auth/session";
import { sendEmail } from "../notify/email";
import { assignUnassignedPublishing } from "../projects/lifecycle";

// Admin > People. Every action re-checks the admin role and stays inside the admin's organisation.

async function requireAdmin(): Promise<Ctx> {
  const ctx = await requireCtx();
  assert(can.manage(ctx.user), "Only admins can manage people.");
  return ctx;
}

type Result = { ok: true; link?: string; emailed?: boolean; message?: string } | { ok: false; error: string };

const inviteSchema = z.object({
  name: z.string().trim().min(2, "Add their name.").max(80),
  email: z.string().trim().toLowerCase().email("That email doesn't look right.").max(200),
  isChampion: z.boolean().default(false),
  isAdmin: z.boolean().default(false),
  isPublishingSpecialist: z.boolean().default(false),
});

async function deliverLink(ctx: Ctx, email: string, name: string, link: string, reset: boolean) {
  return sendEmail(email, {
    subject: reset ? `Your Spine access for ${ctx.org.name}` : `${ctx.user.name} invited you to Spine`,
    text: reset
      ? `Hi ${name},\n\nUse this link to set a new password for Spine at ${ctx.org.name}. It works once and expires in 7 days.\n\n${link}`
      : `Hi ${name},\n\n${ctx.user.name} invited you to join ${ctx.org.name} on Spine, where the company organises its AI questions, ideas and initiatives.\n\nSet up your account (the link works once and expires in 7 days):\n${link}`,
  });
}

export async function invitePerson(raw: unknown): Promise<Result> {
  const ctx = await requireAdmin();
  const parsed = inviteSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the form." };
  const d = parsed.data;
  const settings = await ctx.db.settings.findUnique({ where: { orgId: ctx.org.id } });
  if (settings?.allowedEmailDomain && !d.email.endsWith(`@${settings.allowedEmailDomain}`)) {
    return { ok: false, error: `Invitations are limited to @${settings.allowedEmailDomain} addresses (Admin > Organisation).` };
  }
  // Email is unique across Spine: refuse addresses that belong to someone in another organisation.
  const existing = await rootDb.user.findUnique({ where: { email: d.email } });
  if (existing && existing.orgId !== ctx.org.id) return { ok: false, error: "That email already belongs to another organisation in Spine." };
  if (existing && existing.status === "ACTIVE" && existing.passwordHash) return { ok: false, error: `${existing.name} already has access.` };

  const { link } = await issueInvitation({ orgId: ctx.org.id, ...d, invitedById: ctx.user.id, userId: existing?.id ?? null });
  const emailed = await deliverLink(ctx, d.email, d.name, link, false);
  await audit(ctx, "person.invited", "Invitation", null, `${d.name} <${d.email}>${d.isAdmin ? " as admin" : ""}`);
  revalidatePath("/admin");
  return { ok: true, link, emailed };
}

/** A fresh single-use link for someone who already exists (lost password, never set one). */
export async function resetAccess(userId: string): Promise<Result> {
  const ctx = await requireAdmin();
  const person = await ctx.db.user.findUnique({ where: { id: userId } });
  if (!person) return { ok: false, error: "That person isn't in your organisation." };
  if (!person.email) return { ok: false, error: "Add an email address for them first." };
  const { link } = await issueInvitation({ orgId: ctx.org.id, email: person.email, name: person.name, invitedById: ctx.user.id, userId: person.id });
  const emailed = await deliverLink(ctx, person.email, person.name, link, true);
  await audit(ctx, "person.access_reset", "User", person.id, person.name);
  revalidatePath("/admin");
  return { ok: true, link, emailed };
}

export async function revokeInvitation(invitationId: string): Promise<Result> {
  const ctx = await requireAdmin();
  const { count } = await ctx.db.invitation.updateMany({ where: { id: invitationId, acceptedAt: null, revokedAt: null }, data: { revokedAt: new Date() } });
  if (count !== 1) return { ok: false, error: "That invitation is no longer open." };
  await audit(ctx, "invitation.revoked", "Invitation", invitationId);
  revalidatePath("/admin");
  return { ok: true };
}

const emailSchema = z.string().trim().toLowerCase().email("That email doesn't look right.").max(200);

/** People migrated from the demo have no email; an admin adds one before sending access. */
export async function setEmail(userId: string, email: string): Promise<Result> {
  const ctx = await requireAdmin();
  const parsed = emailSchema.safeParse(email);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]!.message };
  const person = await ctx.db.user.findUnique({ where: { id: userId } });
  if (!person) return { ok: false, error: "That person isn't in your organisation." };
  const clash = await rootDb.user.findUnique({ where: { email: parsed.data } });
  if (clash && clash.id !== userId) return { ok: false, error: "Someone already uses that email." };
  await ctx.db.user.update({ where: { id: userId }, data: { email: parsed.data } });
  await audit(ctx, "person.email_changed", "User", userId, person.name);
  revalidatePath("/admin");
  return { ok: true };
}

const rolesSchema = z.object({ isChampion: z.boolean(), isAdmin: z.boolean(), isPublishingSpecialist: z.boolean() });

export async function setRoles(userId: string, raw: unknown): Promise<Result> {
  const ctx = await requireAdmin();
  const parsed = rolesSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Something didn't look right. Try again." };
  const person = await ctx.db.user.findUnique({ where: { id: userId } });
  if (!person) return { ok: false, error: "That person isn't in your organisation." };
  if (person.isAdmin && !parsed.data.isAdmin) {
    const admins = await ctx.db.user.count({ where: { isAdmin: true, status: "ACTIVE" } });
    if (admins <= 1) return { ok: false, error: "Keep at least one active admin." };
  }
  await ctx.db.user.update({ where: { id: userId }, data: parsed.data });
  const roles = [parsed.data.isChampion && "Champion", parsed.data.isAdmin && "Admin", parsed.data.isPublishingSpecialist && "Publishing specialist"].filter(Boolean).join(", ") || "Member";
  await audit(ctx, "person.roles_changed", "User", userId, `${person.name}: ${roles}`);
  if (parsed.data.isPublishingSpecialist) await assignUnassignedPublishing(ctx);
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function setActive(userId: string, active: boolean): Promise<Result> {
  const ctx = await requireAdmin();
  if (userId === ctx.user.id) return { ok: false, error: "You can't deactivate yourself." };
  const person = await ctx.db.user.findUnique({ where: { id: userId } });
  if (!person) return { ok: false, error: "That person isn't in your organisation." };
  if (!active && person.isAdmin) {
    const admins = await ctx.db.user.count({ where: { isAdmin: true, status: "ACTIVE" } });
    if (admins <= 1) return { ok: false, error: "Keep at least one active admin." };
  }
  await ctx.db.user.update({ where: { id: userId }, data: { status: active ? "ACTIVE" : "DEACTIVATED" } });
  if (!active) await destroyAllSessions(userId);
  await audit(ctx, active ? "person.reactivated" : "person.deactivated", "User", userId, person.name);
  revalidatePath("/admin");
  return { ok: true };
}
