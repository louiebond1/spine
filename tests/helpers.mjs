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
export const mainText = (page) => page.locator("main").innerText();
