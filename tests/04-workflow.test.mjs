// Approvals, plan editing, check-ins and outcomes: the server enforces who may act, and reads never write.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import { db, reseed, signIn, closeAll, mainText, interceptAction, replayAction } from "./helpers.mjs";

before(() => reseed());
after(() => closeAll());

const stage = async (id) => (await db.project.findUnique({ where: { id }, select: { stage: true } })).stage;

test("only an admin in the same organisation can approve, and the server checks it", async () => {
  const alex = await signIn("Alex Morgan");
  await alex.page.goto("/ideas/p-supplier-research/approve");
  // Capture the request without letting it reach the server, then replay it as others.
  const intercept = await interceptAction(alex.page);
  await alex.page.getByRole("button", { name: "Approve", exact: true }).click();
  const call = await intercept.call;

  const ben = await signIn("Ben Carter");
  await replayAction(ben, call);
  assert.equal(await stage("p-supplier-research"), "APPROVAL", "a member approved an idea");

  const dana = await signIn("Dana Reed"); // an admin, but in Northwind
  await replayAction(dana, call);
  assert.equal(await stage("p-supplier-research"), "APPROVAL", "an admin from another organisation approved an idea");

  await replayAction(alex, call);
  assert.notEqual(await stage("p-supplier-research"), "APPROVAL", "the real admin's approval didn't go through");
  const events = await db.projectEvent.findMany({ where: { projectId: "p-supplier-research", type: "APPROVED" } });
  assert.equal(events.length, 1);
  assert.equal(events[0].actorId, "u-alex");
});

test("owners can't approve their own idea; returning one sends it back as a draft with the note", async () => {
  const alex = await signIn("Alex Morgan");
  await alex.page.goto("/ideas/p-supplier-risk/approve"); // Alex's own idea
  await alex.page.waitForURL((u) => !u.pathname.endsWith("/approve"), { waitUntil: "commit" });
  assert.equal(await stage("p-supplier-risk"), "APPROVAL");

  await db.project.update({ where: { id: "p-supplier-research" }, data: { stage: "APPROVAL", approvedAt: null, approvedById: null } });
  await alex.page.goto("/ideas/p-supplier-research/approve");
  await alex.page.getByRole("button", { name: "Return with note" }).click();
  await alex.page.fill("#return-note", "Please add which suppliers you'd start with.");
  await alex.page.getByRole("button", { name: "Return to owner" }).click();
  await alex.page.waitForURL((u) => !u.pathname.endsWith("/approve"), { waitUntil: "commit" });
  const p = await db.project.findUnique({ where: { id: "p-supplier-research" } });
  assert.equal(p.stage, "IDEA");
  assert.match(p.returnNote ?? "", /which suppliers/);
});

test("loading pages never auto-approves; only the daily job does", async () => {
  await db.project.update({ where: { id: "p-supplier-risk" }, data: { stage: "APPROVAL", autoApproveAt: new Date("2026-10-01T00:00:00Z") } });
  const alex = await signIn("Alex Morgan");
  for (const path of ["/", "/ideas", "/pulse", "/ideas/p-supplier-risk"]) await alex.page.goto(path);
  assert.equal(await stage("p-supplier-risk"), "APPROVAL", "a GET request changed a project's stage");

  execSync("npm run job:daily", { cwd: new URL("..", import.meta.url), stdio: "ignore" });
  assert.notEqual(await stage("p-supplier-risk"), "APPROVAL", "the daily job didn't auto-approve");
  const event = await db.projectEvent.findFirst({ where: { projectId: "p-supplier-risk", type: "AUTO_APPROVED" } });
  assert.ok(event);
});

test("only team members can tick steps", async () => {
  const step = await db.planStep.findFirst({ where: { projectId: "p-ai-invoice", done: false }, orderBy: { order: "asc" } });
  const jamie = await signIn("Jamie Chen");
  await jamie.page.goto("/ideas/p-ai-invoice?tab=plan");
  const intercept = await interceptAction(jamie.page);
  await jamie.page.getByRole("checkbox", { name: step.title }).click();
  const call = await intercept.call;

  const team = (await db.teamMember.findMany({ where: { projectId: "p-ai-invoice" }, include: { user: true } })).map((m) => m.user.name);
  const outsiders = ["Ben Carter", "Louie Morris", "Dana Reed"];
  assert.ok(outsiders.every((n) => !team.includes(n)), "the seed changed; pick people outside the team");
  for (const name of outsiders) {
    await replayAction(await signIn(name), call);
    assert.equal((await db.planStep.findUnique({ where: { id: step.id } })).done, false, `${name} ticked a step on a team they're not in`);
  }
  await replayAction(jamie, call);
  assert.equal((await db.planStep.findUnique({ where: { id: step.id } })).done, true);
});

test("a blocked check-in reaches Pulse for admins and clears when unblocked", async () => {
  const jamie = await signIn("Jamie Chen");
  await jamie.page.goto("/ideas/p-ai-invoice?tab=checkins");
  await jamie.page.getByRole("radiogroup", { name: "Status" }).getByText("Blocked", { exact: true }).click();
  await jamie.page.getByLabel("Note").fill("Waiting on finance for sample invoices.");
  await jamie.page.getByRole("button", { name: "Check in" }).click();
  await jamie.page.getByText("Checked in. Thanks.").waitFor();

  const p = await db.project.findUnique({ where: { id: "p-ai-invoice" } });
  assert.ok(p.blockedAt);
  const alex = await signIn("Alex Morgan");
  await alex.page.goto("/pulse");
  const pulse = await mainText(alex.page);
  assert.ok(pulse.includes("AI Invoice Assistant"), "a blocked initiative is missing from Pulse");

  await jamie.page.reload();
  await jamie.page.getByRole("radiogroup", { name: "Status" }).getByText("On track", { exact: true }).click();
  await jamie.page.getByRole("button", { name: "Check in" }).click();
  await jamie.page.getByText("Checked in. Thanks.").waitFor();
  assert.equal((await db.project.findUnique({ where: { id: "p-ai-invoice" } })).blockedAt, null);
});

test("members can't see Pulse; people outside the team can't check in", async () => {
  const ben = await signIn("Ben Carter");
  await ben.page.goto("/pulse");
  assert.ok((await mainText(ben.page)).includes("There's nothing here."));

  const jamie = await signIn("Jamie Chen");
  await jamie.page.goto("/ideas/p-ai-invoice?tab=checkins");
  const intercept = await interceptAction(jamie.page);
  await jamie.page.getByRole("radiogroup", { name: "Status" }).getByText("Blocked", { exact: true }).click();
  await jamie.page.getByRole("button", { name: "Check in" }).click();
  const call = await intercept.call;
  const before = await db.checkIn.count({ where: { projectId: "p-ai-invoice" } });
  await replayAction(ben, call);
  await replayAction(await signIn("Dana Reed"), call);
  assert.equal(await db.checkIn.count({ where: { projectId: "p-ai-invoice" } }), before);
});
