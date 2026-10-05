// Start with Spine + meeting notes, end to end in a real browser (fixtures mode).
// node scripts/e2e-start.mjs [baseUrl] [screenshotDir]
import { chromium } from "playwright";

const base = process.argv[2] ?? "http://localhost:3100";
const shots = process.argv[3];
const browser = await chromium.launch();
let failed = 0;
const check = (ok, label) => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}`);
  if (!ok) failed++;
};
async function as(userId) {
  const context = await browser.newContext({ viewport: { width: 1536, height: 971 } });
  await context.addCookies([{ name: "spine_user", value: userId, url: base }]);
  const page = await context.newPage();
  page.errors = [];
  page.on("pageerror", (e) => page.errors.push(String(e)));
  page.on("console", (m) => m.type() === "error" && !m.text().includes("404") && page.errors.push(m.text()));
  return page;
}
const snap = async (page, name) => shots && (await page.screenshot({ path: `${shots}/${name}.png` }));

// 1. Coach conversation to a brief, then create with invites.
const alex = await as("u-alex");
await alex.goto(`${base}/ideas/start`, { waitUntil: "networkidle" });
await alex.getByRole("button", { name: /A supplier risk checker/ }).click();
await snap(alex, "start-1");
await alex.getByRole("button", { name: "Talk it through with Spine" }).click();
let turns = 0;
while (turns < 8) {
  const brief = alex.getByText("Here's your idea, ready to go");
  const chip = alex.locator("main section button.rounded-full").first();
  await Promise.race([brief.waitFor({ timeout: 15000 }), chip.waitFor({ timeout: 15000 })]).catch(() => {});
  if (await brief.isVisible()) break;
  if (turns === 1) await snap(alex, "start-2-coach");
  await chip.click();
  turns++;
}
check(await alex.getByText("Here's your idea, ready to go").isVisible(), `coach reached a brief after ${turns} answers`);
check(await alex.getByText("Real use cases").isVisible(), "brief shows real use cases");
await snap(alex, "start-3-brief");
await alex.getByRole("button", { name: "Create idea" }).click();
await alex.waitForURL(/\/ideas\/[^/]+\/review/, { timeout: 30000 });
check(true, "Create idea goes to the AI review");
const ideaUrl = alex.url().replace(/\/review$/, "");
await alex.waitForLoadState("networkidle");
await snap(alex, "start-4-review");
await alex.goto(`${ideaUrl}?tab=team`, { waitUntil: "networkidle" });
const teamText = await alex.locator("main").innerText();
check(/Mia Thompson[\s\S]*Invited|Invited[\s\S]*Mia/.test(teamText), "Mia shows as invited on the team tab");
check(alex.errors.length === 0, `no console errors for Alex (${alex.errors.slice(0, 2).join(" | ")})`);

// 2. Mia sees the invite on Home and accepts it.
const mia = await as("u-mia");
await mia.goto(base, { waitUntil: "networkidle" });
check((await mia.locator("main").innerText()).includes("invited you to join the team"), "Mia's Home lists the invite");
await mia.goto(`${ideaUrl}?tab=team`, { waitUntil: "networkidle" });
await mia.getByRole("button", { name: "Accept" }).click();
await mia.getByText(/You're in|You've joined/).waitFor({ timeout: 10000 });
check(true, "Mia accepted the invite");

// 3. Meeting notes on AI Invoice Assistant as Jamie.
const jamie = await as("u-jamie");
await jamie.goto(`${base}/ideas`, { waitUntil: "networkidle" });
await jamie.getByRole("link", { name: /AI Invoice Assistant/ }).first().click();
await jamie.waitForLoadState("networkidle");
await jamie.getByRole("button", { name: "Update from meeting notes" }).click();
await jamie.locator("#meeting-notes").fill("Jamie finished testing against real supplier cases.\nSarah will write the how-to guide by 20 Oct.\nMia will check the VAT rounding by Friday.");
await jamie.getByRole("button", { name: "Read notes" }).click();
await jamie.getByRole("button", { name: /Apply \d+ change/ }).waitFor({ timeout: 20000 });
await snap(jamie, "meeting-1-preview");
const preview = await jamie.getByRole("dialog").innerText();
check(preview.includes('Mark "Test against real supplier cases" done'), "preview ticks the finished step");
check(/Add ".*how-to guide.*" for Sarah/i.test(preview), "preview adds Sarah's action");
await jamie.getByRole("button", { name: /Apply \d+ change/ }).click();
await jamie.getByText(/Applied \d+ change/).waitFor({ timeout: 20000 });
check(true, "changes applied");
await jamie.waitForTimeout(1800);
await jamie.reload({ waitUntil: "networkidle" });
const plan = await jamie.locator("main").innerText();
check(/how-to guide/i.test(plan), "new step is on the plan");
await jamie.goto(`${jamie.url().split("?")[0]}?tab=chat`, { waitUntil: "networkidle" });
check((await jamie.locator("main").innerText()).includes("Meeting summary:"), "summary posted to chat");
await snap(jamie, "meeting-2-chat");
check(jamie.errors.length === 0, `no console errors for Jamie (${jamie.errors.slice(0, 2).join(" | ")})`);

await browser.close();
console.log(failed ? `\n${failed} failed` : "\nAll start/meeting checks passed");
process.exit(failed ? 1 : 0);
