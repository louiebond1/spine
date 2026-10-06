// Notifications, stuck-approval chasing, Ask Spine approvals, leadership report, settings and
// "Join this instead" (fixtures mode, freshly seeded). node scripts/e2e-extras.mjs [baseUrl] [shotsDir]
import { execSync } from "node:child_process";
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
const pages = [];
async function as(userId) {
  const context = await browser.newContext({ viewport: { width: 1536, height: 971 } });
  await context.addCookies([{ name: "spine_user", value: userId, url: base }]);
  const page = await context.newPage();
  page.errors = [];
  page.on("pageerror", (e) => page.errors.push(String(e)));
  pages.push(page);
  return page;
}
const snap = async (page, name, full = false) => shots && (await page.screenshot({ path: `${shots}/${name}.png`, fullPage: full }));
const text = (page) => page.locator("main").innerText();
const DAY = 86_400_000;

// 1. A Legal app routes to Alex and Louie; Louie gets a bell notification.
const ben = await as("u-ben");
await ben.goto(`${base}/ideas/new`, { waitUntil: "networkidle" });
await ben.fill("#title", "Clause Library Search");
await ben.fill("#problem", "Lawyers rewrite the same standard clauses because nobody can find the approved wording quickly.");
await ben.fill("#whoBenefits", "Legal team");
await ben.selectOption("#topicId", { label: "Legal" });
await ben.fill("#targetDate", "2026-12-10");
await ben.click("text=Continue to AI review");
await ben.waitForSelector("text=Feasibility", { timeout: 20000 });
await ben.click("button:has-text('Submit for approval')");
await ben.waitForURL(/\/ideas\/[^/]+$/);
let idea = await db.project.findFirst({ where: { title: "Clause Library Search" } });
const louieNote = await db.notification.findFirst({ where: { userId: "u-louie", kind: "approval" } });
check(!!louieNote && louieNote.href === `/ideas/${idea.id}/approve`, "approver gets an approval notification");
const louie = await as("u-louie");
await louie.goto(base, { waitUntil: "networkidle" });
await louie.getByRole("button", { name: /needs? you|New updates/ }).click();
const bell = await louie.locator("div").filter({ hasText: "Notification settings" }).last().innerText();
check(/updates/i.test(bell) && bell.includes("Clause Library Search needs your approval"), `bell shows the update (${bell.slice(0, 80).replace(/\s+/g, " ")})`);
await snap(louie, "extras-1-bell");
await louie.waitForTimeout(1000);
check((await db.notification.count({ where: { userId: "u-louie", readAt: null } })) === 0, "opening the bell marks updates read");

// 2. Ask Spine explains the approval and offers to nudge (fixture path).
const askRes = await ben.request.post(`${base}/api/assistant`, { data: { projectId: idea.id, message: "Who needs to approve this?" } });
const stream = (await askRes.text()).split(/\n/).filter(Boolean).map((l) => JSON.parse(l)).map((e) => (e.type === "text" ? e.delta : e.type === "action" ? ` [${e.action.kind}] ` : "")).join("");
check(stream.includes("Alex Morgan and Louie Morris") && stream.includes("nudge_approvers"), "Ask Spine names the approvers and offers a reminder");

// 3. Stuck approvals: 4 days in, approvers are reminded; 8 days in, any admin can decide.
await db.project.update({ where: { id: idea.id }, data: { submittedAt: new Date(Date.parse("2026-10-07T09:00:00Z") - 4 * DAY) } });
execSync("npm run job:daily", { stdio: "pipe" });
idea = await db.project.findUnique({ where: { id: idea.id } });
check(!!idea.approvalNudgedAt && !idea.escalatedAt, "after 4 days the approvers are nudged, not escalated");
check((await db.notification.count({ where: { kind: "nudge", title: "Still waiting: Clause Library Search" } })) === 2, "both approvers got the reminder");
await db.project.update({ where: { id: idea.id }, data: { submittedAt: new Date(Date.parse("2026-10-07T09:00:00Z") - 8 * DAY) } });
execSync("npm run job:daily", { stdio: "pipe" });
idea = await db.project.findUnique({ where: { id: idea.id } });
check(!!idea.escalatedAt, "after 8 days it is escalated");
const alexEsc = await as("u-alex");
await alexEsc.goto(`${base}/ideas/${idea.id}/approve`, { waitUntil: "networkidle" });
check((await text(alexEsc)).includes("Escalated: any admin can decide now."), "escalation shows on the approval page");

// 4. Leadership report (Louie reads it as a named approver).
await louie.goto(`${base}/programme/report?month=2026-09`, { waitUntil: "networkidle" });
const report = await text(louie);
check(report.includes("September 2026") && report.includes("Hours saved") && report.includes("30") && report.includes("Spine's summary"), "September report shows counted facts and Spine's summary");
await snap(louie, "extras-2-report", true);
const priya = await as("u-priya");
await priya.goto(`${base}/programme/report`, { waitUntil: "networkidle" });
check(!(await text(priya)).includes("Spine's summary"), "a member without leadership role can't see the report");

// 5. Your settings: dark, teal, larger text.
const alex = await as("u-alex");
await alex.goto(`${base}/settings`, { waitUntil: "networkidle" });
await alex.getByRole("radio", { name: "Dark" }).click();
await alex.getByRole("radio", { name: /Teal/ }).click();
await alex.getByRole("radio", { name: "Larger" }).click();
await alex.getByRole("button", { name: "Save changes" }).click();
await alex.getByText("Saved.").waitFor();
await alex.goto(base, { waitUntil: "networkidle" });
const attrs = await alex.locator(".spine-app[data-theme]").first().evaluate((el) => [el.dataset.theme, el.dataset.accent, el.dataset.size].join(","));
check(attrs === "dark,teal,large", "appearance saved and applied");
await snap(alex, "extras-3-dark");
await db.user.update({ where: { id: "u-alex" }, data: { preferences: null } });

// 6. Join this instead.
const sarah = await as("u-sarah");
await sarah.goto(`${base}/ideas/new`, { waitUntil: "networkidle" });
await sarah.fill("#title", "Client brief writer");
await sarah.fill("#problem", "Writing client briefs takes ages; a generator could draft the client brief from notes.");
await sarah.locator("#whoBenefits").click();
await sarah.getByText("Already in flight").waitFor({ timeout: 10000 });
check((await text(sarah)).includes("Client Brief Generator"), "propose form spots the similar project");
await snap(sarah, "extras-4-inflight");
await sarah.getByRole("button", { name: "Join instead" }).first().click();
await sarah.waitForURL(/\/ideas\/p-client-brief$/, { timeout: 15000 });
const cb = await db.project.findUnique({ where: { id: "p-client-brief" }, include: { team: true, messages: true } });
check(cb.team.some((m) => m.userId === "u-sarah") && cb.messages.some((m) => m.body.includes("Client brief writer")), "joined the existing project and posted the idea to its chat");

const errs = pages.flatMap((p) => p.errors);
check(errs.length === 0, `no page errors (${errs.slice(0, 2).join(" | ")})`);
await browser.close();
await db.$disconnect();
console.log(failed ? `\n${failed} failed` : "\nAll extras checks passed");
process.exit(failed ? 1 : 0);
