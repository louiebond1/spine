// Spine Autopilot end-to-end check (freshly seeded DB, SPINE_TODAY set, SPINE_AI_FIXTURES=1).
// node --env-file=.env scripts/e2e-autopilot.mjs <baseUrl>
import { chromium } from "playwright";
import { PrismaClient } from "@prisma/client";

const base = process.argv[2];
const db = new PrismaClient();
const b = await chromium.launch();
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
};
async function as(userId) {
  const c = await b.newContext({ viewport: { width: 1536, height: 971 } });
  await c.addCookies([{ name: "spine_user", value: userId, url: base }]);
  const p = await c.newPage();
  p.on("pageerror", (e) => console.log(`  page error: ${e}`));
  return p;
}
const open = async (p, path) => {
  await p.goto(`${base}${path}`, { waitUntil: "networkidle" });
  await p.waitForTimeout(2500); // recommendations are computed after first paint
  await p.reload({ waitUntil: "networkidle" });
};

const alex = await as("u-alex");

// 1. Forecast and recommendations on a late, quiet build.
await open(alex, "/ideas/p-contract-clause");
const text = await alex.locator("main").innerText();
check("Forecast shows on a building project", /Forecast at the current pace/.test(text));
check("Spine recommends appears", text.includes("Spine recommends"));
await alex.screenshot({ path: "screenshots/a-recommends.png" });

// 2. Apply "move the target", then undo it.
const before = await db.project.findUnique({ where: { id: "p-contract-clause" } });
const row = alex.locator("div.flex.items-start", { hasText: "Move the target" }).first();
await row.locator("button:has-text('Do it')").click();
await alex.waitForTimeout(2000);
const after = await db.project.findUnique({ where: { id: "p-contract-clause" } });
check("Do it moves the target and logs to chat", after.targetDate > before.targetDate && (await db.projectMessage.count({ where: { projectId: "p-contract-clause", body: { contains: "Spine's recommendation" } } })) === 1);
await alex.reload({ waitUntil: "networkidle" });
await alex.locator("button:has-text('Undo')").first().click();
await alex.waitForTimeout(2000);
const undone = await db.project.findUnique({ where: { id: "p-contract-clause" } });
check("Undo restores the original target", undone.targetDate.getTime() === before.targetDate.getTime());

// 3. Stalled recruiting: start building with the current team.
await open(alex, "/ideas/p-client-brief");
const startRow = alex.locator("div.flex.items-start", { hasText: "Start building" }).first();
check("Recruiting stall recommendation appears", (await startRow.count()) === 1);
await startRow.locator("button:has-text('Do it')").click();
await alex.waitForTimeout(3000);
const cb = await db.project.findUnique({ where: { id: "p-client-brief" }, include: { steps: true } });
check("Start with current team moves to Building with an assigned plan", cb.stage === "BUILDING" && cb.teamSize === 3 && cb.steps.length >= 6);

// 4. Permissions: a member who isn't owner/admin can't apply scope changes.
const priya = await as("u-priya");
await open(priya, "/ideas/p-contract-clause");
const priyaButtons = await priya.locator("section:has-text('Spine recommends') button:has-text('Do it')").count();
check("Non-owner, non-team member sees no Do it buttons", priyaButtons === 0, `${priyaButtons} buttons`);

// 5. Ask Spine offers a fix and "yes" applies it.
await open(alex, "/ideas/p-ai-invoice");
const beforeSteps = await db.planStep.findMany({ where: { projectId: "p-ai-invoice", done: false } });
await alex.click("button:has-text('Ask Spine')");
await alex.click("text=What should happen next on this project?");
await alex.waitForSelector("text=Do you want me to", { timeout: 20000 });
await alex.fill("textarea[aria-label='Message Ask Spine']", "yes");
await alex.keyboard.press("Enter");
await alex.waitForTimeout(4000);
await alex.screenshot({ path: "screenshots/a-ask-yes.png" });
const afterSteps = await db.planStep.findMany({ where: { projectId: "p-ai-invoice", done: false } });
const changed = afterSteps.some((s) => beforeSteps.find((x) => x.id === s.id)?.assigneeId !== s.assigneeId);
check("Saying yes in Ask Spine applies the change", changed);

// 6. Portfolio brief on Programme.
await open(alex, "/programme");
check("Programme shows Spine's portfolio brief", (await alex.locator("text=Spine's portfolio brief").count()) === 1);
await alex.screenshot({ path: "screenshots/a-portfolio.png" });

await b.close();
await db.$disconnect();
const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
