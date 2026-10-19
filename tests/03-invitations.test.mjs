// Invitations: an admin invites through the UI, the link works once, and emails can't cross organisations.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { db, reseed, signIn, anonymous, closeAll, BASE, captureAction, replayAction } from "./helpers.mjs";

before(() => reseed());
after(() => closeAll());

async function invite(page, name, emailAddress, { admin = false } = {}) {
  await page.goto("/admin?tab=people");
  await page.fill("#invite-name", name);
  await page.fill("#invite-email", emailAddress);
  if (admin) await page.getByRole("checkbox", { name: "Admin" }).first().check();
  await page.getByRole("button", { name: "Send invitation" }).click();
}

test("an invited person sets a password once and lands in the right organisation as a member", async () => {
  const alex = await signIn("Alex Morgan");
  await invite(alex.page, "Robin Vale", "robin.vale@demo.spine.test");
  const code = alex.page.locator("code").first();
  await code.waitFor();
  const link = (await code.innerText()).trim();
  assert.ok(link.startsWith(`${BASE}/invite/`), `unexpected link ${link}`);
  const token = link.split("/invite/")[1];

  const stored = await db.invitation.findFirst({ where: { email: "robin.vale@demo.spine.test" } });
  assert.ok(stored && stored.tokenHash && !JSON.stringify(stored).includes(token), "the raw invite token is stored");

  const guest = await anonymous();
  await guest.page.goto(`/invite/${token}`);
  await guest.page.fill("#password", "short");
  // The browser's own minLength check stops a short password; a long one goes through.
  await guest.page.fill("#password", "a-long-enough-password");
  await Promise.all([guest.page.waitForURL((u) => !u.pathname.startsWith("/invite")), guest.page.getByRole("button", { name: "Join" }).click()]);

  const robin = await db.user.findUnique({ where: { email: "robin.vale@demo.spine.test" } });
  assert.equal(robin.orgId, "org_demo");
  assert.equal(robin.isAdmin, false);
  assert.equal(robin.isChampion, false);
  assert.equal(robin.status, "ACTIVE");

  // Members can't open Admin.
  await guest.page.goto("/admin");
  assert.ok((await guest.page.locator("main").innerText()).includes("There's nothing here."));

  // The link is single use.
  const again = await anonymous();
  await again.page.goto(`/invite/${token}`);
  assert.ok((await again.page.locator("body").innerText()).includes("This link has expired"));
});

test("emails from another organisation, and bad tokens, are refused", async () => {
  const alex = await signIn("Alex Morgan");
  await invite(alex.page, "Dana Reed", "dana.reed@demo.spine.test");
  await alex.page.getByText("That email already belongs to another organisation in Spine.").waitFor();
  const count = await db.invitation.count({ where: { email: "dana.reed@demo.spine.test" } });
  assert.equal(count, 0);

  const guest = await anonymous();
  await guest.page.goto("/invite/not-a-real-token");
  assert.ok((await guest.page.locator("body").innerText()).includes("This link has expired"));
});

test("a revoked or superseded link stops working", async () => {
  const alex = await signIn("Alex Morgan");
  await invite(alex.page, "Kim Lowe", "kim.lowe@demo.spine.test");
  await alex.page.locator("code").first().waitFor();
  const first = (await alex.page.locator("code").first().innerText()).split("/invite/")[1];
  await invite(alex.page, "Kim Lowe", "kim.lowe@demo.spine.test");
  await alex.page.locator("code").first().waitFor();
  const second = (await alex.page.locator("code").first().innerText()).split("/invite/")[1];
  assert.notEqual(first, second);

  const guest = await anonymous();
  await guest.page.goto(`/invite/${first}`);
  assert.ok((await guest.page.locator("body").innerText()).includes("This link has expired"), "an older link still works after a new one was issued");
  await guest.page.goto(`/invite/${second}`);
  assert.ok((await guest.page.locator("body").innerText()).includes("Join"));
});

test("members get no invite form, and replaying the admin's invite action as a member does nothing", async () => {
  const ben = await signIn("Ben Carter");
  const res = await ben.get("/admin?tab=people");
  assert.ok(!(await res.text()).includes("invite-email"));

  const alex = await signIn("Alex Morgan");
  await alex.page.goto("/admin?tab=people");
  await alex.page.fill("#invite-name", "Sam Ford");
  await alex.page.fill("#invite-email", "sam.ford@demo.spine.test");
  const captured = captureAction(alex.page);
  await alex.page.getByRole("button", { name: "Send invitation" }).click();
  const call = await captured;
  await alex.page.locator("code").first().waitFor();

  const forged = call.body.replace(/sam\.ford@demo\.spine\.test/g, "eve.forged@demo.spine.test").replace(/Sam Ford/g, "Eve Forged");
  assert.notEqual(forged, call.body, "the captured action body didn't contain the email");
  const before = await db.invitation.count();
  await replayAction(ben, call, forged);
  assert.equal(await db.invitation.count(), before, "a member created an invitation");
  assert.equal(await db.invitation.count({ where: { email: "eve.forged@demo.spine.test" } }), 0);

  // The same replay by the admin does work, so the test would catch a broken check.
  await replayAction(alex, call, forged);
  assert.equal(await db.invitation.count({ where: { email: "eve.forged@demo.spine.test" } }), 1);
});
