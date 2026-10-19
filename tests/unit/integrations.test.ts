import { test } from "node:test";
import assert from "node:assert/strict";
import { channelLinkProblem, channelPlatform, slackPayload, teamsPayload, webhookProblem } from "../../src/server/integrations/channels";
import { buildIcs } from "../../src/server/integrations/ics";
import { decrypt, encrypt } from "../../src/server/crypto";

test("webhooks are limited to the providers' own HTTPS hosts", () => {
  assert.equal(webhookProblem("slack", "https://hooks.slack.com/services/T000/B000/XXXX"), null);
  assert.ok(webhookProblem("slack", "http://hooks.slack.com/services/T000/B000/XXXX"));
  assert.ok(webhookProblem("slack", "https://hooks.slack.com.evil.example/services/x"));
  assert.ok(webhookProblem("slack", "https://example.com/services/x"));
  assert.ok(webhookProblem("slack", "https://hooks.slack.com/other"));
  assert.ok(webhookProblem("slack", "not a url"));
  assert.equal(webhookProblem("teams", "https://prod-12.westeurope.logic.azure.com/workflows/abc/triggers/manual/paths/invoke?sig=x"), null);
  assert.equal(webhookProblem("teams", "https://default123.environment.api.powerplatform.com/powerautomate/automations/direct/workflows/abc"), null);
  assert.ok(webhookProblem("teams", "https://logic.azure.com.evil.example/x"));
  assert.ok(webhookProblem("teams", "https://169.254.169.254/latest/meta-data"));
  assert.ok(webhookProblem("teams", "https://localhost/x"));
});

test("channel links accept Teams and Slack only", () => {
  assert.equal(channelLinkProblem("https://teams.microsoft.com/l/channel/19%3Aabc%40thread.tacv2/General"), null);
  assert.equal(channelLinkProblem("https://acme.slack.com/archives/C0123"), null);
  assert.ok(channelLinkProblem("javascript:alert(1)"));
  assert.ok(channelLinkProblem("https://teams.microsoft.com.evil.example/l/channel"));
  assert.ok(channelLinkProblem("http://acme.slack.com/archives/C0123"));
  assert.equal(channelPlatform("https://acme.slack.com/archives/C0123"), "Slack");
  assert.equal(channelPlatform("https://teams.microsoft.com/l/channel/x"), "Teams");
  assert.equal(channelPlatform("nope"), null);
});

test("Slack messages escape text and only mention valid member IDs", () => {
  const p = slackPayload({ title: "A <b>&", text: "<!channel> hi", href: "/ideas/x" }, ["U123ABC", "<!here>", "bad id"]);
  assert.match(p.text, /&lt;b&gt;&amp;/);
  assert.ok(!p.text.includes("<!channel>"), "text could trigger @channel");
  assert.ok(p.text.includes("<@U123ABC>"));
  assert.ok(!p.text.includes("<!here>") && !p.text.includes("bad id"));
});

test("Teams payload is an Adaptive Card message", () => {
  const p = teamsPayload({ title: "T", text: "Body", href: "/pulse" });
  assert.equal(p.type, "message");
  const card = p.attachments[0]!;
  assert.equal(card.contentType, "application/vnd.microsoft.card.adaptive");
  assert.equal(card.content.type, "AdaptiveCard");
  assert.equal(card.content.actions.length, 1);
  assert.equal(teamsPayload({ title: "T", text: "Body" }).attachments[0]!.content.actions.length, 0);
});

test("secrets round-trip through AES-GCM and tampering is rejected", () => {
  const prev = process.env.SPINE_ENCRYPTION_KEY;
  process.env.SPINE_ENCRYPTION_KEY = "unit-test-key-that-is-at-least-32-characters";
  try {
    const sealed = encrypt("https://hooks.slack.com/services/secret");
    assert.ok(!sealed.includes("hooks.slack.com"));
    assert.equal(decrypt(sealed), "https://hooks.slack.com/services/secret");
    assert.notEqual(encrypt("same"), encrypt("same"), "the IV must be random");
    const parts = sealed.split(".");
    parts[3] = Buffer.from("tampered").toString("base64url");
    assert.equal(decrypt(parts.join(".")), null);
    assert.equal(decrypt("garbage"), null);
    process.env.SPINE_ENCRYPTION_KEY = "a-different-key-that-is-also-32-characters-long";
    assert.equal(decrypt(sealed), null, "a different key must not decrypt");
  } finally {
    process.env.SPINE_ENCRYPTION_KEY = prev;
  }
});

test("calendar export follows RFC 5545 escaping and folding", () => {
  const ics = buildIcs("Spine; initiatives", [
    { uid: "step-1@spine", date: new Date("2026-10-09T00:00:00Z"), title: "Test, then fix; ship", description: "Line one\nLine two \\ done", url: "https://spine.example/ideas/p" },
    { uid: "step-2@spine", date: new Date("2026-10-14T00:00:00Z"), title: "Ünïcödé ".repeat(20) },
  ], new Date("2026-10-07T10:00:00Z"));
  assert.ok(ics.startsWith("BEGIN:VCALENDAR\r\n") && ics.endsWith("END:VCALENDAR\r\n"));
  assert.ok(ics.includes("X-WR-CALNAME:Spine\\; initiatives"));
  assert.ok(ics.includes("SUMMARY:Test\\, then fix\\; ship"));
  assert.ok(ics.includes("DESCRIPTION:Line one\\nLine two \\\\ done"));
  assert.ok(ics.includes("DTSTART;VALUE=DATE:20261009") && ics.includes("DTEND;VALUE=DATE:20261010"));
  assert.ok(ics.includes("DTSTAMP:20261007T100000Z"));
  for (const line of ics.split("\r\n")) assert.ok(Buffer.byteLength(line, "utf8") <= 75, `line over 75 octets: ${line}`);
  const unfolded = ics.replace(/\r\n /g, "");
  assert.ok(unfolded.includes(`SUMMARY:${"Ünïcödé ".repeat(20)}`), "folding lost or split characters");
  assert.equal((ics.match(/BEGIN:VEVENT/g) ?? []).length, 2);
});
