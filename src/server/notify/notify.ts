import "server-only";
import { after } from "next/server";
import { readPreferences, wantsEmail, type NotifyKind } from "@/lib/preferences";
import { now } from "../clock";
import { db } from "../db";

// One place that tells people things. Every notification lands in the bell (Updates), and is
// emailed when the person has an address and hasn't switched that kind off. Email goes through
// Resend when RESEND_API_KEY is set, otherwise it is logged, so nothing fails without it.
// Approval requests are also posted to the Slack channel when SLACK_WEBHOOK_URL is set.

export type Note = { kind: NotifyKind; title: string; body: string; href: string };

const appUrl = () => (process.env.SPINE_APP_URL ?? "").replace(/\/$/, "");

async function sendEmail(to: string, note: Note) {
  const key = process.env.RESEND_API_KEY;
  const link = `${appUrl()}${note.href}`;
  if (!key) {
    console.log(`[email] RESEND_API_KEY is not set. Would email ${to}: ${note.title} (${link})`);
    return;
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM ?? "Spine <onboarding@resend.dev>",
      to,
      subject: note.title,
      text: `${note.body}\n\nOpen in Spine: ${link}\n\nYou can change which emails you get in Spine under Your settings.`,
    }),
  });
  if (!res.ok) throw new Error(`Resend returned ${res.status}`);
}

export async function postToSlack(text: string) {
  const url = process.env.SLACK_WEBHOOK_URL;
  if (!url) return;
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }) });
  if (!res.ok) console.error(`[slack] returned ${res.status}`);
}

async function deliver(ids: string[], note: Note) {
  const users = await db.user.findMany({ where: { id: { in: ids } }, select: { id: true, email: true, preferences: true } });
  for (const u of users) {
    if (!u.email || !wantsEmail(readPreferences(u.preferences), note.kind)) continue;
    try {
      await sendEmail(u.email, note);
      await db.notification.updateMany({ where: { userId: u.id, href: note.href, title: note.title, emailedAt: null }, data: { emailedAt: now() } });
    } catch (error) {
      console.error("[email] failed", error);
    }
  }
}

/** Records a notification for each person (never the actor) and sends emails in the background. */
export async function notify(userIds: (string | null | undefined)[], note: Note, actorId?: string | null) {
  const ids = [...new Set(userIds.filter((id): id is string => !!id && id !== actorId))];
  if (ids.length === 0) return;
  const at = now();
  await db.notification.createMany({ data: ids.map((userId) => ({ userId, ...note, at })) });
  try {
    after(() => deliver(ids, note));
  } catch {
    await deliver(ids, note);
  }
}
