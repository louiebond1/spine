// Authentication, sessions, rate limiting and route protection.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { BASE, PASSWORD, anonymous, closeAll, db, email, reseed, signIn } from "./helpers.mjs";

before(() => reseed());
after(() => closeAll());

test("nobody is signed in by default: pages go to sign-in, APIs return 401", async () => {
  const { get } = await anonymous();
  for (const path of ["/", "/admin", "/help-desk", "/ideas", "/pulse", "/leadership", "/playbook", "/settings"]) {
    const r = await get(path);
    assert.equal(r.status(), 307, path);
    assert.match(r.headers().location, /\/login/, path);
  }
  for (const path of ["/api/search?q=a", "/api/attachments/anything", "/api/ideas/p-ai-invoice/calendar"]) {
    assert.equal((await get(path)).status(), 401, path);
  }
  assert.equal((await get("/api/health")).status(), 200);
});

test("the old demo cookie and forged session tokens grant nothing", async () => {
  const { context, get } = await anonymous();
  await context.addCookies([
    { name: "spine_user", value: "u-alex", url: BASE },
    { name: "spine_session", value: "forged-token-value-1234567890", url: BASE },
  ]);
  const r = await get("/admin");
  assert.equal(r.status(), 307);
  const page = await context.newPage();
  await page.goto("/admin");
  assert.match(page.url(), /\/login/);
});

test("wrong password gives one generic message, right password signs in with an httpOnly cookie", async () => {
  const { page, context } = await anonymous();
  await page.goto("/login");
  await page.fill("#email", email("Alex Morgan"));
  await page.fill("#password", "wrong-password-123");
  await page.click("button[type=submit]");
  const alert = page.locator("form [role=alert]");
  await alert.waitFor();
  assert.match(await alert.innerText(), /don't match an active account/);
  await page.fill("#password", PASSWORD);
  await Promise.all([page.waitForURL((u) => u.pathname === "/", { timeout: 15000 }), page.click("button[type=submit]")]);
  const cookie = (await context.cookies()).find((c) => c.name === "spine_session");
  assert.ok(cookie, "session cookie set");
  assert.equal(cookie.httpOnly, true);
  assert.equal(cookie.sameSite, "Lax");
  // Only a hash of the token is stored.
  const rows = await db.session.findMany({ where: { user: { email: email("Alex Morgan") } } });
  assert.ok(rows.length >= 1);
  assert.ok(rows.every((s) => s.tokenHash !== cookie.value && s.tokenHash.length === 64));
});

test("repeated failed sign-ins are rate limited", async () => {
  const { page } = await anonymous();
  await page.goto("/login");
  for (let i = 0; i < 9; i++) {
    await page.fill("#email", email("Ben Carter"));
    await page.fill("#password", `nope-${i}-xxxxxxxx`);
    await page.click("button[type=submit]");
    await page.waitForFunction((n) => document.querySelector("form [role=alert]") && !document.querySelector("button[type=submit]").disabled, i);
  }
  await page.getByText("Too many attempts").waitFor();
  // Even the right password is refused while limited.
  await page.fill("#password", PASSWORD);
  await page.click("button[type=submit]");
  await page.getByText("Too many attempts").waitFor();
  await db.rateLimit.deleteMany();
});

test("sign out ends the session on the server", async () => {
  const { page, context, get } = await signIn("Priya Shah");
  const cookie = (await context.cookies()).find((c) => c.name === "spine_session");
  await page.locator("aside button[aria-expanded]").first().click();
  await Promise.all([page.waitForURL(/\/login/), page.getByRole("button", { name: "Sign out" }).click()]);
  // Replaying the old cookie no longer works.
  await context.addCookies([{ ...cookie }]);
  assert.equal((await get("/")).status(), 307);
});

test("deactivating someone signs them out everywhere and blocks sign-in", async () => {
  const ben = await signIn("Ben Carter");
  assert.equal((await ben.get("/")).status(), 200);
  const alex = await signIn("Alex Morgan");
  await alex.page.goto("/admin?tab=people");
  const row = alex.page.locator("div.py-3", { hasText: email("Ben Carter") }).first();
  await row.getByRole("button", { name: "Deactivate" }).click();
  await alex.page.waitForLoadState("networkidle");
  await assert.doesNotReject(async () => {
    for (let i = 0; i < 20 && (await db.user.findUnique({ where: { id: "u-ben" } })).status !== "DEACTIVATED"; i++) await new Promise((r) => setTimeout(r, 200));
  });
  assert.equal((await db.user.findUnique({ where: { id: "u-ben" } })).status, "DEACTIVATED");
  assert.equal((await ben.get("/")).status(), 307, "existing session no longer works");
  assert.equal(await db.session.count({ where: { userId: "u-ben" } }), 0);
});

test("members can't reach admin, leadership or pulse", async () => {
  const { page } = await signIn("Priya Shah");
  for (const path of ["/admin", "/leadership", "/pulse"]) {
    // Pages stream, so the status is 200, but the body is the not-found page with no admin content.
    await page.goto(path);
    const text = await page.locator("main").innerText();
    assert.match(text, /nothing here/i, path);
    assert.doesNotMatch(text, /Invite people|Verified hours|Pulse/, path);
  }
  await page.goto("/");
  assert.equal(await page.locator("nav[aria-label=Main] a[href='/admin']").count(), 0);
});

test("security headers are set", async () => {
  const { get } = await anonymous();
  const h = (await get("/login")).headers();
  assert.equal(h["x-frame-options"], "DENY");
  assert.equal(h["x-content-type-options"], "nosniff");
});
