// Approval rules end to end (fixtures mode, freshly seeded). node scripts/e2e-approvals.mjs [baseUrl] [shotsDir]
import { chromium } from "playwright";
import { PrismaClient } from "@prisma/client";

const base = process.argv[2] ?? "http://localhost:3100";
const shots = process.argv[3];
const db = new PrismaClient();
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
  return page;
}
const snap = async (page, name, full = false) => shots && (await page.screenshot({ path: `${shots}/${name}.png`, fullPage: full }));
const text = (page) => page.locator("main").innerText();

// 1. Admin sees the rules and writes one from plain English.
const alex = await as("u-alex");
await alex.goto(`${base}/admin?tab=approvals`, { waitUntil: "networkidle" });
let t = await text(alex);
check(t.includes("Leadership sign-off for Legal and Finance apps") && t.includes("Alex Morgan and Louie Morris must all approve"), "seeded rules show as plain sentences");
await snap(alex, "approvals-1-admin", true);
await alex.getByLabel("Describe an approval rule").fill("Anything over 200 hours goes to Sarah and auto-approves after 10 days");
await alex.getByRole("button", { name: "Write the rule" }).click();
await alex.getByRole("button", { name: "Save rule" }).waitFor({ timeout: 20000 });
await alex.getByText(/Sarah Kim approves and it auto-approves after 10 days/).waitFor({ timeout: 10000 });
check(true, "Spine drafted the rule with a live preview sentence");
await snap(alex, "approvals-2-draft", true);
await alex.getByRole("button", { name: "Save rule" }).click();
await alex.getByRole("button", { name: "Save rule" }).waitFor({ state: "detached", timeout: 10000 });
check((await db.approvalRule.count()) === 3, "rule saved");

// 2. A Legal app routes to Alex and Louie, both must approve, never auto-approves.
const ben = await as("u-ben");
await ben.goto(`${base}/ideas/new`, { waitUntil: "networkidle" });
await ben.fill("#title", "Contract Renewal Tracker");
await ben.fill("#problem", "Contract renewal dates live in scattered spreadsheets and we miss notice periods.");
await ben.fill("#whoBenefits", "Legal team");
await ben.selectOption("#topicId", { label: "Legal" });
await ben.fill("#targetDate", "2026-12-10");
await ben.click("text=Continue to AI review");
await ben.waitForSelector("text=Feasibility", { timeout: 20000 });
await ben.click("button:has-text('Submit for approval')");
await ben.waitForURL(/\/ideas\/[^/]+$/);
let idea = await db.project.findFirst({ where: { title: "Contract Renewal Tracker" } });
check(idea.stage === "APPROVAL" && idea.approvalsNeeded === 2 && idea.autoApproveAt === null && idea.approverIds.sort().join() === "u-alex,u-louie", "routed by the Legal rule (2 approvers, no auto-approve)");

// 3. Louie (not an admin) is asked, approves first; it waits for Alex.
const louie = await as("u-louie");
await louie.goto(base, { waitUntil: "networkidle" });
check((await text(louie)).includes("Contract Renewal Tracker"), "Louie (leadership, not admin) has it in needs you");
await louie.goto(`${base}/ideas/${idea.id}/approve`, { waitUntil: "networkidle" });
await louie.getByText("Spine's approval brief").waitFor();
await louie.getByText("Worth doing because").waitFor({ timeout: 20000 });
check(true, "approval brief is written for the approver");
t = await text(louie);
check(!/Feasibility|Originality|\b\d+ ?\/ ?10\b/.test(t), "no AI scores on the approval page");
await snap(louie, "approvals-3-page", true);
await louie.getByRole("button", { name: "Approve" }).click();
await louie.waitForURL(`${base}/`);
idea = await db.project.findUnique({ where: { id: idea.id } });
check(idea.stage === "APPROVAL", "one of two approvals keeps it in Approval");
await louie.goto(`${base}/ideas/${idea.id}/approve`, { waitUntil: "networkidle" });
check((await text(louie)).includes("You approved this"), "Louie sees their approval is recorded");

// 4. Alex approves; it moves to Recruiting.
await alex.goto(base, { waitUntil: "networkidle" });
check((await text(alex)).includes("1 of 2"), "Alex's needs you shows 1 of 2 approvals in");
await alex.goto(`${base}/ideas/${idea.id}/approve`, { waitUntil: "networkidle" });
await alex.getByRole("button", { name: "Approve" }).click();
await alex.waitForURL(new RegExp(`/ideas/${idea.id}$`));
idea = await db.project.findUnique({ where: { id: idea.id } });
check(idea.stage === "RECRUITING", "second approval moves it to Recruiting");

// 5. Someone not named can't approve.
const sarah = await as("u-sarah");
const other = await db.project.findFirst({ where: { stage: "APPROVAL", approverIds: { isEmpty: true }, ownerId: { not: "u-sarah" } } });
await sarah.goto(`${base}/ideas/${other.id}/approve`, { waitUntil: "networkidle" });
check(!sarah.url().endsWith("/approve"), "non-approver is sent away from the approval page");

check(alex.errors.length + louie.errors.length + ben.errors.length === 0, `no page errors (${[...alex.errors, ...louie.errors, ...ben.errors].slice(0, 2).join(" | ")})`);
await browser.close();
await db.$disconnect();
console.log(failed ? `\n${failed} failed` : "\nAll approval checks passed");
process.exit(failed ? 1 : 0);
