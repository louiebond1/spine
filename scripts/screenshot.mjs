// Visual check helper: node scripts/screenshot.mjs <baseUrl> <path without leading slash, e.g. help-desk> <out.png> [userId]
// Captures at 1536 x 971 (the mockups are 1536 x 1024 including a 53px window title bar).
import { chromium } from "playwright";

const [base, path, out, userId] = process.argv.slice(2);
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1536, height: 971 } });
if (userId) await context.addCookies([{ name: "spine_user", value: userId, url: base }]);
const page = await context.newPage();
const errors = [];
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
page.on("pageerror", (e) => errors.push(String(e)));
await page.goto(`${base}/${path.replace(/^\/+/, "")}`, { waitUntil: "networkidle" });
await page.screenshot({ path: out, caret: "initial", fullPage: process.env.FULL === "1" });
await browser.close();
if (errors.length) console.log("Console errors:\n" + errors.join("\n"));
else console.log("Saved", out);
