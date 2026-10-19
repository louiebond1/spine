import "server-only";
import { zonedParts } from "@/lib/tz";
import { now } from "../clock";
import type { Scope } from "../ctx";
import { postToChannels } from "../integrations/channels";
import { getPulse, CHECK_LABEL } from "../pulse/pulse";
import { getSettings } from "../settings";

// The daily Pulse digest: the same list as the Pulse page, posted once a day at digestTime
// (weekdays only when set) to the organisation's connected Slack and Teams channels. Nothing is
// sent when Pulse is empty or no channel is connected.

export function digestText(groups: Awaited<ReturnType<typeof getPulse>>): string {
  return groups
    .map((g) => [`${CHECK_LABEL[g.check]} (${g.total})`, ...g.items.map((i) => `- ${i.title}: ${i.reason}`)].join("\n"))
    .join("\n\n");
}

const day = (d: Date) => {
  const z = zonedParts(d);
  return `${z.year}-${String(z.month).padStart(2, "0")}-${String(z.day).padStart(2, "0")}`;
};

export async function runDigest(scope: Scope, { force = false } = {}): Promise<"sent" | "empty" | "not-due" | "already-sent" | "no-channel"> {
  const settings = await getSettings(scope);
  const t = now();
  const p = zonedParts(t);
  const sentToday = settings.lastDigestSentOn !== null && day(settings.lastDigestSentOn) === day(t);
  if (!force) {
    if (sentToday) return "already-sent";
    const [h, m] = settings.digestTime.split(":").map(Number);
    const weekend = p.weekday === 0 || p.weekday === 6;
    if ((settings.digestWeekdaysOnly && weekend) || p.hour * 60 + p.minute < h! * 60 + m!) return "not-due";
  }
  if (!settings.slackWebhookEnc && !settings.teamsWebhookEnc) return "no-channel";
  const groups = await getPulse(scope);
  if (groups.length > 0) {
    const total = groups.reduce((n, g) => n + g.total, 0);
    await postToChannels(scope.db, scope.org.id, { title: `Spine Pulse: ${total} ${total === 1 ? "thing needs" : "things need"} attention`, text: digestText(groups), href: "/pulse" });
  }
  await scope.db.settings.update({ where: { orgId: scope.org.id }, data: { lastDigestSentOn: t } });
  return groups.length ? "sent" : "empty";
}
