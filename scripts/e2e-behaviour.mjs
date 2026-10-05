// End-to-end behaviour check against a freshly seeded database (npm run seed) with
// SPINE_TODAY set and SPINE_AI_FIXTURES=1. Usage: node scripts/e2e-behaviour.mjs <baseUrl>
import { chromium } from "playwright";
import { PrismaClient } from "@prisma/client";

const base = process.argv[2];
const db = new PrismaClient();
const browser = await chromium.launch();
const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
};

async function as(userId) {
  const context = await browser.newContext({ viewport: { width: 1536, height: 971 } });
  await context.addCookies([{ name: "spine_user", value: userId, url: base }]);
  const page = await context.newPage();
  page.on("pageerror", (e) => console.log(`  page error as ${userId}: ${e}`));
  return page;
}
const go = (page, path) => page.goto(`${base}${path}`, { waitUntil: "networkidle" });
const settle = (page) => page.waitForLoadState("networkidle");

// --- Help Desk ------------------------------------------------------------
{
  const priya = await as("u-priya");
  await go(priya, "/help-desk");
  check("Members see no Claim buttons", (await priya.locator("button:has-text('Claim')").count()) === 0);

  // Anonymous asker is never revealed, even to an admin.
  const alex = await as("u-alex");
  await go(alex, "/help-desk/q-client-info");
  // The demo user switcher lists everyone, so check the page content area only.
  const main = await alex.locator("main").innerText();
  check("Anonymous asker hidden from admin", main.includes("Anonymous") && !main.includes("Priya") && !main.includes("PS"), "thread page");
  await go(alex, "/help-desk");
  const row = await alex.locator("main").innerText();
  check("Anonymous asker hidden in Help Desk list", !/Priya Shahs*·s*Securitys*·s*4h/.test(row));

  await go(alex, "/help-desk");
  await alex.locator("div:has(> a:has-text('Best way to anonymise client data?'))").locator("button:has-text('Claim')").first().click();
  await alex.waitForURL(/\/help-desk\/q-anonymise/);
  let q = await db.question.findUnique({ where: { id: "q-anonymise" } });
  check("Claim records claimer and opens thread", q.status === "IN_PROGRESS" && q.claimerId === "u-alex");
  const ev = await db.questionEvent.count({ where: { questionId: "q-anonymise", type: "CLAIMED" } });
  check("Claim logged as a QuestionEvent", ev === 1);

  await alex.fill("input[name=body]", "Use the anonymise template in the Security guide.");
  await alex.click("button:has-text('Send')");
  await settle(alex);
  await alex.waitForTimeout(500);
  const msgs = await db.questionMessage.count({ where: { questionId: "q-anonymise" } });
  check("Claimer can reply", msgs === 1);

  // Ben (asker) replies, so it is waiting on Alex again and shows on Alex's Home.
  const ben = await as("u-ben");
  await go(ben, "/help-desk/q-anonymise");
  await ben.fill("input[name=body]", "Thanks, where is the guide?");
  await ben.click("button:has-text('Send')");
  await ben.waitForTimeout(800);
  await go(alex, "/");
  check("Waiting-on-you question appears on Home", (await alex.locator("text=Ben Carter is waiting on your reply").count()) === 1);

  // Jamie (not asker or claimer) cannot read the private thread.
  const jamie = await as("u-jamie");
  await go(jamie, "/help-desk/q-anonymise");
  check("Others cannot read an in-progress thread", (await jamie.locator("input[name=body]").count()) === 0);

  await go(ben, "/help-desk/q-anonymise");
  await ben.click("button:has-text('Mark resolved')");
  await ben.waitForTimeout(800);
  q = await db.question.findUnique({ where: { id: "q-anonymise" } });
  check("Asker can resolve; claimer gets the point", q.status === "RESOLVED" && q.claimerId === "u-alex" && q.resolvedAt !== null);
}

// --- Approval, recruiting, plan generation --------------------------------
{
  const alex = await as("u-alex");
  await go(alex, "/ideas/p-supplier-research/approve");
  const flag = await alex.locator("text=AI review raised concerns").count();
  const score = await alex.locator("text=/\\d+ ?\\/10/").count();
  check("Admin sees neutral flag, no scores", flag === 1 && score === 0);
  await alex.click("button:has-text('Approve')");
  await alex.waitForURL(/\/ideas\/p-supplier-research$/);
  let p = await db.project.findUnique({ where: { id: "p-supplier-research" }, include: { team: true } });
  check("Approve moves App idea to Recruiting with owner on team", p.stage === "RECRUITING" && p.approvedById === "u-alex" && p.team.length === 1);

  // Alex can't see someone else's scores.
  const res = await alex.goto(`${base}/ideas/p-supplier-research/review`);
  check("Non-owner gets 404 on AI review", res.status() === 404);

  // Admin can't approve own idea.
  await go(alex, "/ideas/p-supplier-risk/approve");
  check("Admin cannot approve own idea", /\/ideas\/p-supplier-risk$/.test(alex.url()));

  for (const user of ["u-jamie", "u-sarah"]) {
    const page = await as(user);
    await go(page, "/ideas/p-supplier-research?tab=team");
    await page.click("button:has-text('Join project')");
    await page.waitForTimeout(1500);
  }
  await new Promise((r) => setTimeout(r, 2500));
  p = await db.project.findUnique({ where: { id: "p-supplier-research" }, include: { steps: true, team: true } });
  check("Full team moves to Building", p.stage === "BUILDING" && p.team.length === 3);
  check(
    "Build plan generated: 6 to 10 steps, assigned to team, due before target",
    p.steps.length >= 6 && p.steps.length <= 10 && p.steps.every((s) => p.team.some((m) => m.userId === s.assigneeId) && s.dueDate <= p.targetDate && s.generatedFromBrief),
    `${p.steps.length} steps`,
  );
}

// --- Finishing a build, publishing, Live -----------------------------------
{
  const jamie = await as("u-jamie");
  await go(jamie, "/ideas/p-ai-invoice");
  for (let i = 0; i < 3; i++) {
    await jamie.locator("input[type=checkbox]:not(:checked)").first().check();
    await jamie.waitForTimeout(1200);
    await go(jamie, "/ideas/p-ai-invoice");
  }
  const p = await db.project.findUnique({ where: { id: "p-ai-invoice" } });
  check("All steps done moves App project to Publishing", p.stage === "PUBLISHING");
  check("Publisher is the specialist with the lightest load (Mia)", p.publisherId === "u-mia");
  const sys = await db.projectMessage.count({ where: { projectId: "p-ai-invoice", isSystem: true, body: { startsWith: "Jamie completed" } } });
  check("Ticking a step posts a system message", sys >= 3);

  const alex = await as("u-alex");
  await go(alex, "/ideas/p-ai-invoice");
  check("Only the assigned publisher sees Mark Live", (await alex.locator("button:has-text('Mark Live')").count()) === 0);
  const mia = await as("u-mia");
  await go(mia, "/ideas/p-ai-invoice");
  await mia.click("button:has-text('Mark Live')");
  await mia.waitForTimeout(1200);
  const live = await db.project.findUnique({ where: { id: "p-ai-invoice" } });
  check("Publisher marks it Live", live.stage === "LIVE" && live.liveAt !== null);
}

// --- Propose, submit, return with note ------------------------------------
{
  const priya = await as("u-priya");
  await go(priya, "/ideas/new");
  await priya.fill("#title", "Policy Question Bot");
  await priya.fill("#problem", "People ask the same HR policy questions every week and wait days for answers.");
  await priya.fill("#whoBenefits", "Everyone");
  await priya.selectOption("#topicId", { label: "People" });
  await priya.fill("#targetDate", "2026-12-10");
  await priya.click("text=Continue to AI review");
  await priya.waitForSelector("text=Feasibility", { timeout: 20000 });
  await priya.click("button:has-text('Submit for approval')");
  await priya.waitForURL(/\/ideas\/[^/]+$/);
  const idea = await db.project.findFirst({ where: { title: "Policy Question Bot" } });
  const hours = (idea.autoApproveAt - idea.submittedAt) / 3_600_000;
  check("Submit sets Approval and autoApproveAt = now + 7 days", idea.stage === "APPROVAL" && hours === 168);

  const alex = await as("u-alex");
  await go(alex, `/ideas/${idea.id}/approve`);
  await alex.click("button:has-text('Return with note')");
  await alex.fill("#return-note", "Please say which policies it covers first.");
  await alex.click("button:has-text('Return to owner')");
  await alex.waitForURL(`${base}/`);
  const returned = await db.project.findUnique({ where: { id: idea.id } });
  check("Return sends it back as a draft with the note", returned.stage === "IDEA" && returned.returnNote?.startsWith("Please say"));
  await go(priya, `/ideas/new?from=${idea.id}`);
  check("Return note shown at the top of the form", (await priya.locator("text=Please say which policies it covers first.").count()) === 1);
}

// --- Cowork-native: join race, build, approval after build, return, re-approve -------
{
  // Meeting Summary Bot is 1 of 3. Three people race for the last two places.
  const racers = await Promise.all(["u-louie", "u-mia", "u-ben"].map((u) => as(u)));
  await Promise.all(racers.map((pg) => go(pg, "/ideas/p-meeting-summary?tab=team")));
  await Promise.all(racers.map((pg) => pg.click("button:has-text('Join project')").catch(() => {})));
  await new Promise((r) => setTimeout(r, 4000));
  let p = await db.project.findUnique({ where: { id: "p-meeting-summary" }, include: { team: true, steps: true } });
  check("Concurrent joins never overfill the team", p.team.length === 3, `${p.team.length} members`);
  check("Cowork-native team full moves to Building with a plan", p.stage === "BUILDING" && p.steps.length >= 6);

  // The team ticks every step: Cowork-native goes to Approval after the build.
  const memberId = p.team[0].userId;
  const member = await as(memberId);
  await db.planStep.updateMany({ where: { projectId: p.id, order: { gt: 0 } }, data: { done: true } });
  await go(member, "/ideas/p-meeting-summary");
  await member.locator("input[type=checkbox]:not(:checked)").first().check();
  await member.waitForTimeout(1500);
  p = await db.project.findUnique({ where: { id: "p-meeting-summary" } });
  check("Finished Cowork-native build goes to Approval", p.stage === "APPROVAL" && p.buildCompletedAt !== null && p.autoApproveAt !== null);

  const alex = await as("u-alex");
  await go(alex, "/ideas/p-meeting-summary/approve");
  await alex.click("button:has-text('Return with note')");
  await alex.fill("#return-note", "Add a summary template first.");
  await alex.click("button:has-text('Return to owner')");
  await alex.waitForURL(`${base}/`);
  p = await db.project.findUnique({ where: { id: "p-meeting-summary" }, include: { steps: true } });
  check("Cowork-native returned after build goes back to Building with an open step", p.stage === "BUILDING" && p.steps.some((s) => !s.done && s.title === "Address the approval note"));

  const owner = await as(p.ownerId);
  await go(owner, "/ideas/p-meeting-summary");
  await owner.locator("input[type=checkbox]:not(:checked)").first().check();
  await owner.waitForTimeout(1500);
  await go(alex, "/ideas/p-meeting-summary/approve");
  await alex.click("button:has-text('Approve')");
  await alex.waitForTimeout(1500);
  p = await db.project.findUnique({ where: { id: "p-meeting-summary" } });
  check("Approving a built Cowork-native project moves it straight to Publishing with a publisher", p.stage === "PUBLISHING" && p.publisherId !== null);
}

await browser.close();
await db.$disconnect();
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
