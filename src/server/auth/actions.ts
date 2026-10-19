"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { rootDb } from "../db";
import { createOrganization } from "../org/setup";
import { hashPassword, passwordProblem, verifyPassword } from "./crypto";
import { findOpenInvitation } from "./invitations";
import { allow, clearLimit } from "./rate-limit";
import { createSession, destroyAllSessions, destroyCurrentSession, getSessionUser } from "./session";

/** `values` echoes what was typed (never passwords) so a failed submit doesn't clear the form. */
export type FormState = { error?: string; values?: Record<string, string> };

const clientIp = async () => ((await headers()).get("x-forwarded-for") ?? "").split(",")[0]?.trim() || "local";

/** Only same-site relative paths, so a crafted link can't bounce someone to another site. */
function safeNext(next: unknown) {
  const n = typeof next === "string" ? next : "";
  return n.startsWith("/") && !n.startsWith("//") && !n.startsWith("/\\") ? n : "/";
}

const loginSchema = z.object({ email: z.string().trim().toLowerCase().email().max(200), password: z.string().min(1).max(200) });

export async function login(_prev: FormState, form: FormData): Promise<FormState> {
  const values = { email: String(form.get("email") ?? "").slice(0, 200) };
  const parsed = loginSchema.safeParse({ email: form.get("email"), password: form.get("password") });
  if (!parsed.success) return { error: "Enter your email and password.", values };
  const { email, password } = parsed.data;
  const ip = await clientIp();
  const okEmail = await allow(`login:email:${email}`, 8, 15 * 60_000);
  const okIp = await allow(`login:ip:${ip}`, 30, 15 * 60_000);
  if (!okEmail || !okIp) return { error: "Too many attempts. Wait 15 minutes and try again.", values };

  const user = await rootDb.user.findUnique({ where: { email } });
  const valid = await verifyPassword(password, user?.passwordHash);
  if (!user || !valid || user.status !== "ACTIVE") return { error: "That email and password don't match an active account.", values };

  await clearLimit(`login:email:${email}`);
  await createSession(user.id);
  redirect(safeNext(form.get("next")));
}

export async function logout() {
  await destroyCurrentSession();
  redirect("/login");
}

const acceptSchema = z.object({
  token: z.string().min(10).max(200),
  name: z.string().trim().min(2, "Add your name.").max(80),
  password: z.string(),
});

/** Accepting an invitation creates the account (or resets access) and signs the person in. */
export async function acceptInvitation(_prev: FormState, form: FormData): Promise<FormState> {
  const values = { name: String(form.get("name") ?? "").slice(0, 80) };
  const parsed = acceptSchema.safeParse({ token: form.get("token"), name: form.get("name"), password: form.get("password") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form.", values };
  if (!(await allow(`invite:ip:${await clientIp()}`, 20, 15 * 60_000))) return { error: "Too many attempts. Wait 15 minutes and try again.", values };
  const problem = passwordProblem(parsed.data.password);
  if (problem) return { error: problem, values };

  const inv = await findOpenInvitation(parsed.data.token);
  if (!inv) return { error: "This link has expired or was already used. Ask your admin for a new one." };
  const passwordHash = await hashPassword(parsed.data.password);
  const name = parsed.data.name;
  const initials = name.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();

  const userId = await rootDb.$transaction(async (tx) => {
    // Claim the invitation first so a link can only ever be used once.
    const claimed = await tx.invitation.updateMany({ where: { id: inv.id, acceptedAt: null, revokedAt: null }, data: { acceptedAt: new Date() } });
    if (claimed.count !== 1) throw new Error("used");
    const existing = inv.userId
      ? await tx.user.findFirst({ where: { id: inv.userId, orgId: inv.orgId } })
      : await tx.user.findUnique({ where: { email: inv.email } });
    if (existing && existing.orgId !== inv.orgId) throw new Error("other-org");
    if (existing) {
      // Access reset or re-invite: keep roles unless the invitation grants new ones.
      const u = await tx.user.update({
        where: { id: existing.id },
        data: {
          name: inv.userId ? existing.name : name,
          initials: inv.userId ? existing.initials : initials,
          email: inv.email,
          passwordHash,
          status: "ACTIVE",
          isChampion: existing.isChampion || inv.isChampion,
          isAdmin: existing.isAdmin || inv.isAdmin,
          isPublishingSpecialist: existing.isPublishingSpecialist || inv.isPublishingSpecialist,
        },
      });
      return u.id;
    }
    const u = await tx.user.create({
      data: { orgId: inv.orgId, name, initials, email: inv.email, passwordHash, status: "ACTIVE", isChampion: inv.isChampion, isAdmin: inv.isAdmin, isPublishingSpecialist: inv.isPublishingSpecialist },
    });
    return u.id;
  }).catch((e: Error) => (e.message === "other-org" ? "other-org" : null));

  if (userId === "other-org") return { error: "That email already belongs to another organisation in Spine.", values };
  if (!userId) return { error: "This link has expired or was already used. Ask your admin for a new one.", values };
  await destroyAllSessions(userId);
  await createSession(userId);
  redirect("/");
}

/** Self-serve sign-up is off unless SPINE_ALLOW_SIGNUP=1 (production uses the bootstrap script). */
export const signupEnabled = async () => process.env.SPINE_ALLOW_SIGNUP === "1";

const signupSchema = z.object({
  org: z.string().trim().min(2, "Name your organisation.").max(80),
  name: z.string().trim().min(2, "Add your name.").max(80),
  email: z.string().trim().toLowerCase().email("That email doesn't look right.").max(200),
  password: z.string(),
});

export async function signup(_prev: FormState, form: FormData): Promise<FormState> {
  if (!(await signupEnabled())) return { error: "Sign-up is closed. Ask your admin for an invitation." };
  const values = { org: String(form.get("org") ?? "").slice(0, 80), name: String(form.get("name") ?? "").slice(0, 80), email: String(form.get("email") ?? "").slice(0, 200) };
  const parsed = signupSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form.", values };
  if (!(await allow(`signup:ip:${await clientIp()}`, 5, 60 * 60_000))) return { error: "Too many sign-ups from here. Try again later.", values };
  const problem = passwordProblem(parsed.data.password);
  if (problem) return { error: problem, values };
  if (await rootDb.user.findUnique({ where: { email: parsed.data.email } })) return { error: "That email already has an account. Sign in instead.", values };

  const passwordHash = await hashPassword(parsed.data.password);
  const name = parsed.data.name;
  const user = await rootDb.$transaction(async (tx) => {
    const org = await createOrganization(parsed.data.org, tx);
    return tx.user.create({
      data: {
        orgId: org.id,
        name,
        initials: name.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase(),
        email: parsed.data.email,
        passwordHash,
        status: "ACTIVE",
        isAdmin: true,
        isChampion: true,
      },
    });
  });
  await createSession(user.id);
  redirect("/");
}

const passwordSchema = z.object({ current: z.string().max(200), next: z.string() });

export async function changePassword(_prev: FormState & { saved?: boolean }, form: FormData): Promise<FormState & { saved?: boolean }> {
  const s = await getSessionUser();
  if (!s) redirect("/login");
  const parsed = passwordSchema.safeParse({ current: form.get("current"), next: form.get("next") });
  if (!parsed.success) return { error: "Fill in both fields." };
  if (!(await allow(`password:${s.user.id}`, 5, 15 * 60_000))) return { error: "Too many attempts. Wait 15 minutes." };
  if (!(await verifyPassword(parsed.data.current, s.user.passwordHash))) return { error: "Your current password isn't right." };
  const problem = passwordProblem(parsed.data.next);
  if (problem) return { error: problem };
  await rootDb.user.update({ where: { id: s.user.id }, data: { passwordHash: await hashPassword(parsed.data.next) } });
  await destroyAllSessions(s.user.id, s.sessionId);
  return { saved: true };
}
