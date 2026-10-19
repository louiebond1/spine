// Marketing screenshots of the demo data at 2x (desktop) and 3x (phone).
// npm run seed, npm run build && npm start, then:
//   CHROMIUM_PATH=... node --env-file=.env scripts/advert-screenshots.mjs <output dir>
import { chromium } from "playwright";
import { BASE, PASSWORD, email } from "../tests/helpers.mjs";
const OUT = process.argv[2];
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH });
async function as(name, viewport, scale) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: scale, baseURL: BASE });
  const page = await ctx.newPage();
  await page.goto("/login");
  await page.fill("#email", email(name));
  await page.fill("#password", PASSWORD);
  await Promise.all([page.waitForURL((u) => !u.pathname.startsWith("/login")), page.click("button[type=submit]")]);
  return page;
}
async function shot(page, path, file, { full = false, before } = {}) {
  await page.goto(path);
  await page.waitForFunction(() => { const m = document.querySelector("main"); return m && !m.querySelector(".animate-pulse") && m.innerText.trim().length > 0; });
  await page.waitForLoadState("networkidle");
  if (before) await before(page);
  await page.mouse.move(0, page.viewportSize().height - 1);
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/${file}.png`, fullPage: full });
}
const desk = { width: 1440, height: 900 };
const alex = await as("Alex Morgan", desk, 2);
await shot(alex, "/", "01-home-what-needs-you");
await shot(alex, "/help-desk", "02-help-desk");
await shot(alex, "/help-desk/q-excel", "03-private-question-thread");
await shot(alex, "/ideas", "04-initiatives-board");
await shot(alex, "/ideas/p-ai-invoice", "05-initiative-plan");
await shot(alex, "/ideas/p-ai-invoice?tab=checkins", "06-check-ins");
await shot(alex, "/ideas/p-supplier-research/approve", "07-approval-decision");
await shot(alex, "/pulse", "08-pulse-whats-stuck");
await shot(alex, "/playbook", "09-playbook");
await shot(alex, "/discover", "10-discover");
await shot(alex, "/leadership", "11-leadership");
await shot(alex, "/ideas/new", "12-propose-an-idea");
await shot(alex, "/", "13-search-palette", { before: async (p) => { await p.keyboard.press("Control+k"); await p.keyboard.type("supplier"); await p.waitForTimeout(800); } });
const phone = { width: 390, height: 844 };
const mob = await as("Alex Morgan", phone, 3);
await shot(mob, "/", "20-phone-home");
await shot(mob, "/help-desk/q-excel", "21-phone-thread");
await shot(mob, "/ideas/p-ai-invoice", "22-phone-initiative");
await shot(mob, "/pulse", "23-phone-pulse");
const ben = await as("Ben Carter", desk, 2);
await shot(ben, "/", "30-member-home");
await browser.close();
