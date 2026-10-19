// Organisation isolation and Help Desk privacy, checked through the real HTTP surface.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { db, reseed, signIn, closeAll, mainText } from "./helpers.mjs";

const NOT_FOUND = "There's nothing here.";

before(() => reseed());
after(() => closeAll());

test("another organisation's questions, projects and answers are invisible", async () => {
  const dana = await signIn("Dana Reed");
  for (const path of ["/help-desk/q-excel", "/help-desk/q-resolved-3", "/ideas/p-ai-invoice"]) {
    await dana.page.goto(path);
    assert.ok((await mainText(dana.page)).includes(NOT_FOUND), `${path} should be not found for Northwind`);
  }
  const ics = await dana.get("/api/ideas/p-ai-invoice/calendar");
  assert.equal(ics.status(), 404);

  for (const path of ["/help-desk?tab=answers", "/discover", "/playbook", "/ideas"]) {
    await dana.page.goto(path);
    const text = await mainText(dana.page);
    assert.ok(!text.includes("AI Invoice Assistant"), `${path} leaks an Acme project`);
    assert.ok(!text.includes("Can Claude analyse multiple Excel files"), `${path} leaks an Acme question`);
  }

  const search = await (await dana.get("/api/search?q=Invoice")).json();
  const flat = JSON.stringify(search);
  assert.ok(flat.includes("Northwind"), "Dana should find her own organisation's work");
  assert.ok(!flat.includes("AI Invoice Assistant") && !flat.includes("Alex Morgan"), "search leaks across organisations");

  const alex = await signIn("Alex Morgan");
  for (const path of ["/help-desk/nw-q-payroll", "/help-desk/nw-q-shared", "/ideas/nw-p-payroll"]) {
    await alex.page.goto(path);
    assert.ok((await mainText(alex.page)).includes(NOT_FOUND), `${path} should be not found for Acme`);
  }
  await alex.page.goto("/playbook");
  assert.ok(!(await mainText(alex.page)).includes("Northwind priority"));
  const alexSearch = JSON.stringify(await (await alex.get("/api/search?q=Northwind")).json());
  assert.ok(!alexSearch.includes("Northwind"), "search leaks Northwind into Acme");
});

test("resolved questions stay private unless the asker shares a summary", async () => {
  const shared = await db.question.findMany({ where: { orgId: "org_demo", status: "RESOLVED", sharedAt: { not: null } }, select: { id: true } });
  const sharedIds = new Set(shared.map((q) => q.id));
  const privateQ = await db.question.findFirst({
    where: { orgId: "org_demo", status: "RESOLVED", sharedAt: null, askerId: { not: "u-ben" }, claimerId: { not: "u-ben" } },
    include: { messages: { take: 1 } },
  });
  assert.ok(privateQ && privateQ.messages.length > 0);

  const ben = await signIn("Ben Carter");
  await ben.page.goto(`/help-desk/${privateQ.id}`);
  assert.ok((await mainText(ben.page)).includes(NOT_FOUND), "a member opened someone else's private resolved thread");

  const sharedId = [...sharedIds][0];
  const sharedRow = await db.question.findUnique({ where: { id: sharedId }, include: { messages: { take: 1 } } });
  await ben.page.goto(`/help-desk/${sharedId}`);
  const text = await mainText(ben.page);
  assert.ok(text.includes("A summary the asker chose to share"));
  assert.ok(!text.includes(sharedRow.messages[0].body.slice(0, 40)), "the shared view leaks the private conversation");

  // An admin who isn't a participant can't read a private thread either.
  const nonAlex = await db.question.findFirst({
    where: { orgId: "org_demo", status: "RESOLVED", sharedAt: null, askerId: { not: "u-alex" }, claimerId: { not: "u-alex" } },
  });
  const alex = await signIn("Alex Morgan");
  await alex.page.goto(`/help-desk/${nonAlex.id}`);
  assert.ok((await mainText(alex.page)).includes(NOT_FOUND), "an admin read a private thread they aren't part of");
});

test("attachments are served only to the asker and the claimer", async () => {
  const attachment = await db.attachment.findFirst({ where: { message: { questionId: "q-excel" } } });
  assert.ok(attachment);
  const path = `/api/attachments/${attachment.id}`;

  const sarah = await signIn("Sarah Kim"); // asker
  assert.equal((await sarah.get(path)).status(), 200);
  const alex = await signIn("Alex Morgan"); // claimer
  const ok = await alex.get(path);
  assert.equal(ok.status(), 200);
  assert.match(ok.headers()["cache-control"] ?? "", /no-store/);

  for (const name of ["Jamie Chen", "Ben Carter", "Dana Reed"]) {
    const other = await signIn(name);
    assert.equal((await other.get(path)).status(), 404, `${name} downloaded a private attachment`);
  }
  const unknown = await sarah.get("/api/attachments/does-not-exist");
  assert.equal(unknown.status(), 404);
});

test("members get no queue, and an anonymous asker is never named", async () => {
  const ben = await signIn("Ben Carter");
  await ben.page.goto("/help-desk?tab=queue");
  const benText = await mainText(ben.page);
  assert.ok(!benText.includes("Is Claude allowed to access client information"), "a member sees the Champion queue");

  const alex = await signIn("Alex Morgan");
  await alex.page.goto("/help-desk/q-client-info");
  const preview = await mainText(alex.page);
  assert.ok(preview.includes("Is Claude allowed to access client information"), "champions can preview unclaimed questions");
  assert.ok(!preview.includes("Priya"), "the anonymous asker is named on the thread");
  const html = await alex.page.content();
  assert.ok(!html.includes("u-priya") && !html.includes("Priya Shah"), "the anonymous asker leaks into the page source");

  const search = JSON.stringify(await (await alex.get("/api/search?q=client information")).json());
  assert.ok(!search.includes("Priya"), "search reveals the anonymous asker");
});
