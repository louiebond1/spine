import "server-only";
import { now } from "../clock";
import { decrypt } from "../crypto";
import type { OrgDb } from "../tenant";
import { appUrl } from "../auth/invitations";

/**
 * Organisation-level channel posts. Spine only uses capabilities it can rely on without
 * special tenant permissions: a Slack incoming webhook and a Microsoft Teams Workflows webhook,
 * each set up by an admin for one channel. Spine never reads channel history or private messages.
 */

export type ChannelMessage = {
  title: string;
  text: string;
  /** Path inside Spine, linked from the message. */
  href?: string;
  /** People to @mention in Slack, by Spine user id (needs their Slack member ID in Settings). */
  mentionUserIds?: string[];
};

const SLACK_HOSTS = ["hooks.slack.com"];
const TEAMS_HOST_SUFFIXES = [".logic.azure.com", ".powerplatform.com", ".powerautomate.com"];

/** Only HTTPS URLs on the providers' own webhook hosts are accepted (no arbitrary outbound calls). */
export function webhookProblem(kind: "slack" | "teams", raw: string): string | null {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return "That isn't a valid URL.";
  }
  if (url.protocol !== "https:") return "Webhook URLs must start with https://";
  if (kind === "slack" && !(SLACK_HOSTS.includes(url.hostname) && url.pathname.startsWith("/services/"))) {
    return "Use a Slack incoming webhook URL (https://hooks.slack.com/services/...).";
  }
  if (kind === "teams" && !TEAMS_HOST_SUFFIXES.some((s) => url.hostname.endsWith(s))) {
    return "Use the URL from a Teams Workflows \"When a Teams webhook request is received\" flow.";
  }
  return null;
}

const escSlack = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function slackPayload(m: ChannelMessage, slackIds: string[]) {
  const link = m.href ? `${appUrl()}${m.href}` : null;
  const title = link ? `<${link}|${escSlack(m.title)}>` : escSlack(m.title);
  const mentions = slackIds.filter((id) => /^[UW][A-Z0-9]{2,20}$/.test(id)).map((id) => `<@${id}>`).join(" ");
  return { text: `*${title}*\n${escSlack(m.text)}${mentions ? `\n${mentions}` : ""}` };
}

/** The message shape a Teams Workflows webhook flow posts as an Adaptive Card. */
export function teamsPayload(m: ChannelMessage) {
  const link = m.href ? `${appUrl()}${m.href}` : null;
  return {
    type: "message",
    attachments: [
      {
        contentType: "application/vnd.microsoft.card.adaptive",
        contentUrl: null,
        content: {
          $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
          type: "AdaptiveCard",
          version: "1.4",
          body: [
            { type: "TextBlock", text: m.title, weight: "Bolder", wrap: true },
            { type: "TextBlock", text: m.text, wrap: true },
          ],
          actions: link ? [{ type: "Action.OpenUrl", title: "Open in Spine", url: link }] : [],
        },
      },
    ],
  };
}

async function postJson(url: string, body: unknown): Promise<string> {
  try {
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(10_000), redirect: "error" });
    return res.ok ? "ok" : `HTTP ${res.status}`;
  } catch (error) {
    return error instanceof Error && error.name === "TimeoutError" ? "timed out" : "unreachable";
  }
}

/** Posts to every channel the organisation has connected and records the result for Admin. */
export async function postToChannels(db: OrgDb, orgId: string, m: ChannelMessage): Promise<{ slack?: string; teams?: string }> {
  const s = await db.settings.findUnique({ where: { orgId } });
  if (!s) return {};
  const out: { slack?: string; teams?: string } = {};
  const slackUrl = decrypt(s.slackWebhookEnc);
  if (slackUrl) {
    const ids = m.mentionUserIds?.length
      ? (await db.user.findMany({ where: { id: { in: m.mentionUserIds } }, select: { slackUserId: true } })).map((u) => u.slackUserId).filter((x): x is string => !!x)
      : [];
    out.slack = await postJson(slackUrl, slackPayload(m, ids));
  }
  const teamsUrl = decrypt(s.teamsWebhookEnc);
  if (teamsUrl) out.teams = await postJson(teamsUrl, teamsPayload(m));
  if (out.slack || out.teams) {
    const t = now();
    await db.settings.update({
      where: { orgId },
      data: {
        ...(out.slack ? { slackLastAt: t, slackLastStatus: out.slack } : {}),
        ...(out.teams ? { teamsLastAt: t, teamsLastStatus: out.teams } : {}),
      },
    });
  }
  for (const [k, v] of Object.entries(out)) if (v !== "ok") console.error(`[channels] ${k} post failed: ${v}`);
  return out;
}

/** A link a team pastes to the Teams or Slack channel where the initiative's work happens. */
export function channelLinkProblem(raw: string): string | null {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return "Paste the channel's link.";
  }
  if (url.protocol !== "https:") return "Channel links start with https://";
  const ok = url.hostname === "teams.microsoft.com" || url.hostname.endsWith(".slack.com") || url.hostname === "app.slack.com" || url.hostname === "teams.cloud.microsoft";
  return ok ? null : "Use a Microsoft Teams or Slack channel link.";
}

export function channelPlatform(url: string | null | undefined): "Teams" | "Slack" | null {
  if (!url) return null;
  try {
    const h = new URL(url).hostname;
    return h.includes("slack.com") ? "Slack" : h.includes("microsoft") ? "Teams" : null;
  } catch {
    return null;
  }
}
