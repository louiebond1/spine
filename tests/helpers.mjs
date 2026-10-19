// Shared helpers for the end-to-end tests. They run against a production build
// (`npm run build && npm start`) with a freshly seeded database, and never use AI fixtures.
import { execSync } from "node:child_process";
import { chromium } from "playwright";
import { PrismaClient } from "@prisma/client";

export const BASE = process.env.SPINE_TEST_URL ?? "http://localhost:3000";
export const PASSWORD = process.env.SPINE_DEMO_PASSWORD ?? "spine-demo-password";
export const db = new PrismaClient();
export const email = (name) => `${name.toLowerCase().replace(/[^a-z]+/g, ".")}@demo.spine.test`;

export function reseed() {
  execSync("npm run seed", { cwd: new URL("..", import.meta.url), stdio: "ignore" });
}

let browser;
export async function getBrowser() {
  browser ??= await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  return browser;
}

/** A signed-in browser context for one person (by display name). */
export async function signIn(name, { viewport = { width: 1440, height: 900 } } = {}) {
  const b = await getBrowser();
  const context = await b.newContext({ viewport, baseURL: BASE });
  const page = await context.newPage();
  page.errors = [];
  page.on("pageerror", (e) => page.errors.push(String(e)));
  await page.goto("/login");
  await page.fill("#email", email(name));
  await page.fill("#password", PASSWORD);
  await Promise.all([page.waitForURL((u) => !u.pathname.startsWith("/login")), page.click("button[type=submit]")]);
  return { context, page, get: (path) => context.request.get(path, { maxRedirects: 0 }) };
}

export async function anonymous() {
  const b = await getBrowser();
  const context = await b.newContext({ baseURL: BASE });
  return { context, page: await context.newPage(), get: (path) => context.request.get(path, { maxRedirects: 0 }) };
}

export async function closeAll() {
  await browser?.close();
  await db.$disconnect();
}

/** Page text of the main content area only (the sidebar lists the viewer's own name). */
/** Waits for streamed content to replace the loading skeleton, so "doesn't contain" checks aren't vacuous. */
export async function mainText(page) {
  await page.waitForFunction(() => {
    const main = document.querySelector("main");
    return !!main && !main.querySelector(".animate-pulse") && main.innerText.trim().length > 0;
  });
  return page.locator("main").innerText();
}

/**
 * Records the next server action request a page sends, so a test can replay it as someone else
 * and prove the server (not just the UI) enforces the permission.
 */
export function captureAction(page) {
  return new Promise((resolve) => {
    const onRequest = (req) => {
      const action = req.headers()["next-action"];
      if (req.method() === "POST" && action) {
        page.off("request", onRequest);
        resolve({ url: req.url(), headers: { "next-action": action, "content-type": req.headers()["content-type"], accept: "text/x-component" }, body: req.postData() });
      }
    };
    page.on("request", onRequest);
  });
}

/** Replays a captured server action with another person's session. */
export function replayAction(ctx, captured, body = captured.body) {
  return ctx.context.request.post(captured.url, { headers: captured.headers, data: body, maxRedirects: 0 });
}

/**
 * Like captureAction, but the request never reaches the server: the next server action the page
 * sends is recorded and aborted (as is every later one from that page), so a test can replay it
 * as other people first. Replays go through the context's request API, which isn't intercepted.
 */
export async function interceptAction(page) {
  // Pages can fire their own actions on load (the approval brief does); only catch what the test triggers.
  await page.waitForLoadState("networkidle");
  let resolve;
  const captured = new Promise((r) => (resolve = r));
  const handler = async (route) => {
    const req = route.request();
    const action = req.headers()["next-action"];
    if (req.method() === "POST" && action) {
      // Every action from this page stays blocked (Next can resend one), only the first is recorded.
      resolve({ url: req.url(), headers: { "next-action": action, "content-type": req.headers()["content-type"], accept: "text/x-component" }, body: req.postData() });
      return route.abort();
    }
    return route.continue();
  };
  await page.route("**/*", handler);
  return { call: captured };
}
