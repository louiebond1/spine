// AI failure states against the real Anthropic API, with a deliberately invalid key (no fixtures).
// Needs a second server: ANTHROPIC_API_KEY=sk-ant-invalid ANTHROPIC_MODEL=<any> npx next start -p 3001
import { test, before, after } from "node:test";
import assert from "node:assert/strict";

process.env.SPINE_TEST_URL = process.env.SPINE_AI_FAILURE_URL ?? "http://localhost:3001";
const { db, reseed, signIn, closeAll, mainText } = await import("./helpers.mjs");

const reachable = await fetch(`${process.env.SPINE_TEST_URL}/api/health`).then((r) => r.ok, () => false);

before(() => reachable && reseed());
after(() => closeAll());

test("a rejected AI key shows a calm message, never blocks, and is visible to admins", { skip: !reachable && "the invalid-key server isn't running" }, async () => {
  const alex = await signIn("Alex Morgan");
  await alex.page.goto("/ideas/p-supplier-research/approve");
  await alex.page.getByText("AI is paused: the AI provider rejected Spine's key.", { exact: false }).waitFor({ timeout: 30_000 });

  const calls = await db.aiCall.findMany({ where: { orgId: "org_demo" }, orderBy: { at: "desc" } });
  assert.ok(calls.length >= 1);
  assert.equal(calls[0].ok, false);
  assert.equal(calls[0].errorKind, "auth");

  // A second view inside the cooldown doesn't call the provider again.
  await alex.page.reload();
  await alex.page.getByText("AI is paused", { exact: false }).waitFor({ timeout: 30_000 });
  assert.equal(await db.aiCall.count({ where: { orgId: "org_demo" } }), calls.length, "the provider was called again during the cooldown");

  // Deciding still works without AI.
  await alex.page.getByRole("button", { name: "Approve", exact: true }).click();
  for (let i = 0; i < 50 && (await db.project.findUnique({ where: { id: "p-supplier-research" } })).stage === "APPROVAL"; i++) await new Promise((r) => setTimeout(r, 200));
  assert.notEqual((await db.project.findUnique({ where: { id: "p-supplier-research" } })).stage, "APPROVAL");

  // Admins see it on every Admin tab and in AI & health.
  await alex.page.goto("/admin?tab=people");
  assert.ok((await mainText(alex.page)).includes("AI features are failing"));
  await alex.page.goto("/admin?tab=health");
  const health = await mainText(alex.page);
  assert.ok(health.includes("rejected Spine's key"));
  assert.ok(health.includes("Check ANTHROPIC_API_KEY"), "admins aren't told how to fix it");

  // Northwind's AI health is its own.
  const dana = await signIn("Dana Reed");
  await dana.page.goto("/admin?tab=people");
  assert.ok(!(await mainText(dana.page)).includes("AI features are failing"), "one organisation's AI failures show in another");
});

test("the AI review failure leaves the idea usable", { skip: !reachable && "the invalid-key server isn't running" }, async () => {
  await db.aiCall.deleteMany({});
  const priya = await signIn("Priya Shah");
  await priya.page.goto("/ideas/new");
  const text = await mainText(priya.page);
  assert.ok(text.length > 0);
  // The workspace of an existing idea still loads with AI down.
  await priya.page.goto("/ideas/p-knowledge-search");
  assert.ok((await mainText(priya.page)).includes("Knowledge Search Assistant"));
  assert.deepEqual(priya.page.errors, []);
});
