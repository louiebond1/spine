import "server-only";
import { after } from "next/server";
import { readPreferences, wantsEmail, type NotifyKind } from "@/lib/preferences";
import { now } from "../clock";
import type { OrgDb } from "../tenant";
import { appUrl } from "../auth/invitations";
import { sendEmail } from "./email";

// One place that tells people things. Every notification lands in the bell, and is emailed when
// the person has an address and hasn't switched that kind off. Channel posts (Slack, Teams) are
// separate: see ../integrations/channels.ts.

export type Note = { kind: NotifyKind; title: string; body: string; href: string };

async function deliver(db: OrgDb, ids: string[], note: Note) {
  const users = await db.user.findMany({ where: { id: { in: ids }, status: "ACTIVE" }, select: { id: true, email: true, preferences: true } });
  for (const u of users) {
    if (!u.email || !wantsEmail(readPreferences(u.preferences), note.kind)) continue;
    const sent = await sendEmail(u.email, {
      subject: note.title,
      text: `${note.body}\n\nOpen in Spine: ${appUrl()}${note.href}\n\nYou can choose which emails you get under Settings.`,
    });
    if (sent) await db.notification.updateMany({ where: { userId: u.id, href: note.href, title: note.title, emailedAt: null }, data: { emailedAt: now() } });
  }
}

/** Records a notification for each person in this organisation (never the actor), then emails in the background. */
export async function notify(db: OrgDb, userIds: (string | null | undefined)[], note: Note, actorId?: string | null) {
  const wanted = [...new Set(userIds.filter((id): id is string => !!id && id !== actorId))];
  if (wanted.length === 0) return;
  // Only people in this organisation: the scoped client won't return anyone else.
  const ids = (await db.user.findMany({ where: { id: { in: wanted }, status: "ACTIVE" }, select: { id: true } })).map((u) => u.id);
  if (ids.length === 0) return;
  const at = now();
  await db.notification.createMany({ data: ids.map((userId) => ({ userId, ...note, at })) });
  try {
    after(() => deliver(db, ids, note));
  } catch {
    await deliver(db, ids, note);
  }
}
