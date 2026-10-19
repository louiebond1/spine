// Every main screen works at phone width (390 x 844) and desktop, with no horizontal scrolling.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { reseed, signIn, anonymous, closeAll, mainText } from "./helpers.mjs";

const SHOTS = process.env.SPINE_SCREENSHOT_DIR;
if (SHOTS) mkdirSync(SHOTS, { recursive: true });

const PAGES = [
  ["home", "/"],
  ["help-desk", "/help-desk"],
  ["thread", "/help-desk/q-excel"],
  ["initiatives", "/ideas"],
  ["initiatives-list", "/ideas?view=list"],
  ["initiative", "/ideas/p-ai-invoice"],
  ["checkins", "/ideas/p-ai-invoice?tab=checkins"],
  ["propose", "/ideas/new"],
  ["approve", "/ideas/p-supplier-research/approve"],
  ["pulse", "/pulse"],
  ["playbook", "/playbook"],
  ["discover", "/discover"],
  ["leadership", "/leadership"],
  ["admin", "/admin"],
  ["admin-health", "/admin?tab=health"],
  ["settings", "/settings"],
];

before(() => reseed());
after(() => closeAll());

async function overflow(page) {
  return page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
}

for (const [label, viewport] of [["mobile", { width: 390, height: 844 }], ["desktop", { width: 1440, height: 900 }]]) {
  test(`${label}: no horizontal scroll and no page errors on any main screen`, async () => {
    const alex = await signIn("Alex Morgan", { viewport });
    for (const [name, path] of PAGES) {
      await alex.page.goto(path);
      await mainText(alex.page);
      const extra = await overflow(alex.page);
      assert.ok(extra <= 0, `${path} scrolls sideways by ${extra}px at ${viewport.width}px`);
      if (SHOTS) await alex.page.screenshot({ path: `${SHOTS}/${label}-${name}.png`, fullPage: true });
    }
    assert.deepEqual(alex.page.errors, []);
  });
}

test("mobile: the navigation drawer opens and navigates", async () => {
  const alex = await signIn("Alex Morgan", { viewport: { width: 390, height: 844 } });
  await alex.page.goto("/");
  const nav = alex.page.getByRole("dialog", { name: "Navigation" });
  assert.equal(await nav.count(), 0);
  await alex.page.getByRole("button", { name: "Open navigation" }).click();
  await nav.waitFor();
  if (SHOTS) await alex.page.screenshot({ path: `${SHOTS}/mobile-drawer.png` });
  await nav.getByRole("link", { name: "Help Desk" }).click();
  await alex.page.waitForURL(/\/help-desk/);
  await nav.waitFor({ state: "detached" });
});

test("mobile: sign-in fits the screen", async () => {
  const guest = await anonymous();
  await guest.page.setViewportSize({ width: 390, height: 844 });
  await guest.page.goto("/login");
  assert.ok((await overflow(guest.page)) <= 0);
  if (SHOTS) await guest.page.screenshot({ path: `${SHOTS}/mobile-login.png` });
});
