import "server-only";
import { zonedParts } from "@/lib/tz";
import { now } from "../clock";
import { db } from "../db";
import { getPulseItems, type PulseItem } from "../pulse/pulse";
import { getSettings } from "../settings";

// CLAUDE.md section 7, Pulse: the same list as the Pulse page, sent to Slack at digestTime
// (weekdays only when set), and nothing at all when the list is empty.

export function buildDigest(items: PulseItem[], appUrl: string | undefined): string {
  const lines = items.map((i) => {
    const title = appUrl ? `<${appUrl.replace(/\/$/, "")}${i.action.href}|${i.title}>` : i.title;
    return `• *${title}*: ${i.reason}`;
  });
  return [`*Worth your attention today* (${items.length})`, ...lines].join("\n");
}

async function send(text: string) {
  const url = process.env.SLACK_WEBHOOK_URL;
  if (!url) {
    console.log(`[digest] SLACK_WEBHOOK_URL is not set, so here is the digest:\n${text}`);
    return;
  }
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }) });
  if (!res.ok) throw new Error(`Slack returned ${res.status}`);
}

/** Sends today's digest once, at or after digestTime. `force` ignores the schedule (for testing). */
export async function runDigest({ force = false } = {}): Promise<"sent" | "empty" | "not-due" | "already-sent"> {
  const settings = await getSettings();
  const t = now();
  const p = zonedParts(t);
  const day = (d: Date) => {
    const z = zonedParts(d);
    return `${z.year}-${String(z.month).padStart(2, "0")}-${String(z.day).padStart(2, "0")}`;
  };
  const today = day(t);
  const sentToday = settings.lastDigestSentOn !== null && day(settings.lastDigestSentOn) === today;

  if (!force) {
    if (sentToday) return "already-sent";
    const [h, m] = settings.digestTime.split(":").map(Number);
    const isWeekend = p.weekday === 0 || p.weekday === 6;
    if ((settings.digestWeekdaysOnly && isWeekend) || p.hour * 60 + p.minute < h! * 60 + m!) return "not-due";
  }

  const items = await getPulseItems();
  if (items.length > 0) await send(buildDigest(items, process.env.SPINE_APP_URL));
  await db.settings.update({ where: { id: "singleton" }, data: { lastDigestSentOn: t } });
  console.log(`[digest] ${today}: ${items.length ? `sent ${items.length} item(s)` : "nothing to send"}`);
  return items.length ? "sent" : "empty";
}
