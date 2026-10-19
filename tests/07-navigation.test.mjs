// Real clicks through flows that only change the query string. A route-level loading.tsx once
// swallowed these navigations silently (tabs, Board/List, Ask a question), and no test clicked them.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { db, reseed, signIn, closeAll, mainText } from "./helpers.mjs";

before(() => reseed());
after(() => closeAll());

test("Help Desk tabs and the Board/List toggle navigate on click", async () => {
  const ben = await signIn("Ben Carter");
  await ben.page.goto("/help-desk");
  await mainText(ben.page);
  await ben.page.getByRole("link", { name: "Shared answers" }).click();
  await ben.page.waitForURL(/tab=answers/);

  await ben.page.goto("/ideas");
  await mainText(ben.page);
  await ben.page.getByText("List", { exact: true }).click();
  await ben.page.waitForURL(/view=list/);
});

test("anyone can ask a question from + New, and it lands in their list", async () => {
  const ben = await signIn("Ben Carter");
  await ben.page.goto("/");
  await mainText(ben.page);
  await ben.page.getByRole("button", { name: "New" }).click();
  await ben.page.getByRole("menuitem", { name: /Ask a question/ }).click();
  await ben.page.locator("#ask-title").pressSequentially("Can Claude compare several Excel files at once?", { delay: 10 });
  // Typed key by key: the form once moved focus back to the title after every keystroke.
  await ben.page.locator("#ask-body").click();
  await ben.page.keyboard.type("One sales report per region, and I want one table.", { delay: 10 });
  assert.equal(await ben.page.locator("#ask-title").inputValue(), "Can Claude compare several Excel files at once?");
  assert.equal(await ben.page.locator("#ask-body").inputValue(), "One sales report per region, and I want one table.");
  await ben.page.locator("#ask-topic").selectOption({ label: "Excel" });
  await ben.page.getByRole("button", { name: "Ask", exact: true }).click();
  for (let i = 0; i < 50 && !(await db.question.findFirst({ where: { title: "Can Claude compare several Excel files at once?" } })); i++) await new Promise((r) => setTimeout(r, 200));
  const q = await db.question.findFirst({ where: { title: "Can Claude compare several Excel files at once?" } });
  assert.ok(q, "the question wasn't created");
  assert.equal(q.askerId, "u-ben");
  assert.equal(q.status, "UNCLAIMED");
});

test("the Help Desk button opens the same form", async () => {
  const ben = await signIn("Ben Carter");
  await ben.page.goto("/help-desk");
  await mainText(ben.page);
  await ben.page.getByRole("link", { name: "Ask a question" }).click();
  await ben.page.locator("#ask-title").waitFor();
});
