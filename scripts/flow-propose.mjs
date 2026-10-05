// Visual check for 04 and 05: walks the propose flow as Alex with SPINE_AI_FIXTURES=1.
// node scripts/flow-propose.mjs <baseUrl>
import { chromium } from "playwright";

const base = process.argv[2];
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1536, height: 971 } });
await context.addCookies([{ name: "spine_user", value: "u-alex", url: base }]);
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));

await page.goto(`${base}/ideas/new`, { waitUntil: "networkidle" });
await page.fill("#title", "Supplier Risk Checker");
await page.fill(
  "#problem",
  "We don't have a simple way to spot risk signals on our existing suppliers. The information is spread across several systems and takes ages to check. This would flag risk signals automatically and give a short summary for each supplier.",
);
await page.fill("#whoBenefits", "Procurement team");
await page.selectOption("#topicId", { label: "Procurement" });
await page.selectOption("#teamSize", "2");
await page.selectOption("#hoursPerWeek", "2");
await page.selectOption("#lengthWeeks", "3");
await page.selectOption("#difficulty", "MODERATE");
await page.fill("#targetDate", "2026-11-26");
await page.screenshot({ path: "screenshots/flow-04-propose.png", caret: "initial" });

await page.click("text=Continue to AI review");
await page.waitForURL(/\/review$/);
await page.waitForSelector("text=Feasibility", { timeout: 20000 });
await page.screenshot({ path: "screenshots/flow-05-review.png", caret: "initial" });

await browser.close();
console.log(errors.length ? `Errors:\n${errors.join("\n")}` : "Flow screenshots saved");
