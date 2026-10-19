// Marketing screen recordings of real Spine flows with a visible cursor, encoded to H.264.
// Headless screencasts only capture at 1x, so pages render in a 2880 x 1620 window with
// CSS zoom 2: the layout is the 1440-wide one (no breakpoint is above 1280) and every frame is sharp.
// npm run seed, npm run build && npm start, then:
//   CHROMIUM_PATH=... node --env-file=.env scripts/record-clips.mjs <output dir> [clip names...]
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { chromium } from "playwright";
import { BASE, PASSWORD, email, db } from "../tests/helpers.mjs";

const OUT = process.argv[2];
const ONLY = process.argv.slice(3);
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH });

const ZOOM = 2;
const CURSOR = (zoom) => {
  const make = () => {
    document.documentElement.style.zoom = String(zoom);
    if (document.getElementById("rec-cursor")) return;
    const c = document.createElement("div");
    c.id = "rec-cursor";
    c.innerHTML = '<svg width="44" height="44" viewBox="0 0 24 24"><path d="M4 2l16 9.5-7 1.5-3.5 6.5z" fill="#0F1733" stroke="#fff" stroke-width="1.5" stroke-linejoin="round"/></svg>';
    // Mouse events report window pixels, so the cursor undoes the page zoom to line up with them.
    Object.assign(c.style, { position: "fixed", left: "-80px", top: "-80px", zIndex: 2147483647, pointerEvents: "none", transition: "transform 120ms ease", transformOrigin: "8px 4px", zoom: String(1 / zoom) });
    document.documentElement.appendChild(c);
    const at = JSON.parse(sessionStorage.getItem("rec-cursor") || "null");
    if (at) Object.assign(c.style, { left: `${at[0] - 8}px`, top: `${at[1] - 4}px` });
    addEventListener("mousemove", (e) => {
      Object.assign(c.style, { left: `${e.clientX - 8}px`, top: `${e.clientY - 4}px` });
      sessionStorage.setItem("rec-cursor", JSON.stringify([e.clientX, e.clientY]));
    }, true);
    addEventListener("mousedown", () => (c.style.transform = "scale(0.82)"), true);
    addEventListener("mouseup", () => (c.style.transform = "scale(1)"), true);
  };
  if (document.readyState === "loading") addEventListener("DOMContentLoaded", make);
  else make();
};

async function clip(name, who, run) {
  if (ONLY.length && !ONLY.includes(name)) return;
  const viewport = { width: 1440 * ZOOM, height: 810 * ZOOM };
  const ctx = await browser.newContext({ viewport, baseURL: BASE });
  await ctx.addInitScript(CURSOR, ZOOM);
  const page = await ctx.newPage();
  await page.goto("/login");
  await page.fill("#email", email(who));
  await page.fill("#password", PASSWORD);
  await Promise.all([page.waitForURL((u) => !u.pathname.startsWith("/login")), page.click("button[type=submit]")]);

  const dir = join(OUT, `.${name}`);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir);
  const frames = [];
  const cdp = await ctx.newCDPSession(page);
  cdp.on("Page.screencastFrame", async (f) => {
    const file = `${String(frames.length).padStart(5, "0")}.jpg`;
    writeFileSync(join(dir, file), Buffer.from(f.data, "base64"));
    frames.push({ file, t: f.metadata.timestamp });
    await cdp.send("Page.screencastFrameAck", { sessionId: f.sessionId }).catch(() => {});
  });

  let pos = { x: viewport.width / 2, y: viewport.height / 2 };
  const h = {
    page,
    wait: (ms) => page.waitForTimeout(ms),
    async ready() {
      await page.waitForFunction(() => { const m = document.querySelector("main"); return m && !m.querySelector(".animate-pulse") && m.innerText.trim().length > 0; });
      await page.waitForLoadState("networkidle");
    },
    async glide(x, y, ms = 700) {
      const steps = Math.max(12, Math.round(ms / 16));
      for (let i = 1; i <= steps; i++) {
        const k = i / steps;
        const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
        await page.mouse.move(pos.x + (x - pos.x) * e, pos.y + (y - pos.y) * e);
        await page.waitForTimeout(ms / steps);
      }
      pos = { x, y };
    },
    async to(locator, ms) {
      await locator.scrollIntoViewIfNeeded();
      const b = await locator.boundingBox();
      await h.glide(b.x + Math.min(b.width / 2, 60), b.y + b.height / 2, ms);
    },
    async click(locator, ms) {
      await h.to(locator, ms);
      await page.waitForTimeout(180);
      await page.mouse.down();
      await page.waitForTimeout(90);
      await page.mouse.up();
    },
    async type(locator, text, delay = 38) {
      await h.click(locator);
      await locator.pressSequentially(text, { delay });
    },
    async scroll(dy, ms = 900) {
      dy *= ZOOM;
      const steps = Math.round(ms / 16);
      for (let i = 0; i < steps; i++) {
        await page.mouse.wheel(0, dy / steps);
        await page.waitForTimeout(16);
      }
    },
  };

  await page.mouse.move(pos.x, pos.y);
  await cdp.send("Page.startScreencast", { format: "jpeg", quality: 92, everyNthFrame: 1, maxWidth: viewport.width, maxHeight: viewport.height });
  try {
    await run(h);
  } catch (error) {
    await page.screenshot({ path: join(OUT, `${name}-failed.png`) });
    throw error;
  }
  await page.waitForTimeout(800);
  await cdp.send("Page.stopScreencast");
  await ctx.close();

  // Frames only arrive when the screen changes, so each one lasts until the next.
  const list = frames.map((f, i) => `file '${f.file}'\nduration ${((frames[i + 1]?.t ?? f.t + 0.8) - f.t).toFixed(4)}`).join("\n");
  writeFileSync(join(dir, "list.txt"), `ffconcat version 1.0\n${list}\nfile '${frames.at(-1).file}'\n`);
  const target = join(OUT, `${name}.mp4`);
  execFileSync("ffmpeg", ["-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", join(dir, "list.txt"), "-vf", "fps=30,scale=trunc(iw/2)*2:trunc(ih/2)*2,format=yuv420p", "-c:v", "libx264", "-preset", "slow", "-crf", "16", "-movflags", "+faststart", target]);
  rmSync(dir, { recursive: true, force: true });
  console.log(`${name}.mp4 (${frames.length} frames)`);
}


// One story, start to finish, so a trailer can follow a single idea: a company-specific
// question answered and reused, then Supplier Research Assistant from approval to verified hours.
// Between clips the demo data moves forward the way a few days of real work would.
const DAY = 86_400_000;
const today = new Date(process.env.SPINE_TODAY ?? Date.now());
const days = (n) => new Date(today.getTime() + n * DAY);
const P = "p-supplier-research";
const QUESTION = "Can I put client contract data into Copilot?";

await clip("01-home-what-needs-you", "Alex Morgan", async (h) => {
  await h.page.goto("/");
  await h.ready();
  await h.wait(1200);
  await h.to(h.page.getByText("Supplier Research Assistant").first(), 900);
  await h.wait(500);
  await h.to(h.page.getByText("Can Claude analyse multiple Excel files?").first(), 600);
  await h.wait(400);
  await h.to(h.page.getByRole("link", { name: "Review" }).first(), 800);
  await h.wait(1200);
});

await clip("02-ask-a-question", "Priya Shah", async (h) => {
  await h.page.goto("/help-desk");
  await h.ready();
  await h.wait(600);
  await h.click(h.page.getByRole("link", { name: "Ask a question" }).first());
  const title = h.page.locator("#ask-title");
  await title.waitFor();
  await h.wait(400);
  await h.type(title, QUESTION);
  await h.wait(800);
  await h.type(h.page.locator("#ask-body"), "A client sent their contract as a PDF and I'd like Copilot to summarise the key terms.", 22);
  await h.wait(300);
  await h.click(h.page.locator("#ask-topic"));
  await h.page.locator("#ask-topic").selectOption({ label: "Security" });
  await h.wait(500);
  await h.click(h.page.getByRole("button", { name: "Ask", exact: true }));
  await h.wait(2200);
});

await clip("03-champion-answers", "Mia Thompson", async (h) => {
  await h.page.goto("/help-desk");
  await h.ready();
  await h.wait(900);
  const row = h.page.locator("main div").filter({ hasText: QUESTION }).filter({ has: h.page.getByRole("button", { name: "Claim" }) }).last();
  await h.to(h.page.getByText(QUESTION).first(), 800);
  await h.wait(400);
  await h.click(row.getByRole("button", { name: "Claim" }), 700);
  await h.page.waitForURL(/\/help-desk\/[^?]+/);
  await h.ready();
  await h.wait(900);
  await h.type(h.page.getByLabel("Message"), "Not in Copilot yet: it's approved for internal data only until Legal signs off. Use the company Claude workspace, and replace client names first. It's all in the Playbook.", 20);
  await h.wait(400);
  await h.click(h.page.getByRole("button", { name: "Send", exact: true }));
  await h.wait(2400);
});

// The asker marks it answered and shares a summary, so it can help the next person.
{
  const q = await db.question.findFirst({ where: { title: QUESTION } });
  if (q) {
    await db.question.update({
      where: { id: q.id },
      data: { status: "RESOLVED", resolvedAt: today, answerSummary: "Not in Copilot yet: it's approved for internal data only until Legal signs off. Use the company Claude workspace and replace client names first.", sharedAt: today, sharedById: q.askerId },
    });
  }
}

await clip("04-answer-helps-someone-else", "Ben Carter", async (h) => {
  await h.page.goto("/help-desk");
  await h.ready();
  await h.wait(600);
  await h.click(h.page.getByRole("link", { name: "Ask a question" }).first());
  const title = h.page.locator("#ask-title");
  await title.waitFor();
  await h.wait(300);
  await h.type(title, "Is client contract data OK in Copilot?");
  await h.page.getByText("Already answered?").waitFor({ timeout: 8000 });
  await h.wait(700);
  await h.to(h.page.getByRole("dialog").getByText(QUESTION).first(), 900);
  await h.wait(2200);
});

await clip("05-approve-the-idea", "Alex Morgan", async (h) => {
  await h.page.goto(`/ideas/${P}/approve`);
  await h.ready();
  await h.wait(1200);
  await h.to(h.page.getByText("Problem").first(), 700);
  await h.wait(900);
  await h.click(h.page.getByRole("button", { name: "Approve", exact: true }), 900);
  await h.page.waitForURL(new RegExp(`/ideas/${P}(\\?|$)`)).catch(() => {});
  await h.ready();
  await h.wait(2000);
});

await clip("06-someone-joins", "Jamie Chen", async (h) => {
  await h.page.goto(`/ideas/${P}?tab=team`);
  await h.ready();
  await h.wait(1100);
  await h.click(h.page.getByRole("button", { name: "Join the team" }), 900);
  await h.wait(2400);
});

// A third person joins and the team's plan is ready (Spine drafts it from the brief).
{
  await db.teamMember.upsert({ where: { projectId_userId: { projectId: P, userId: "u-sarah" } }, update: {}, create: { projectId: P, userId: "u-sarah", joinedAt: today } });
  await db.planStep.deleteMany({ where: { projectId: P } });
  const steps = [
    ["List the supplier sources Procurement trusts", "listing trusted supplier sources", "u-louie", 2],
    ["Build the research prompt and output template", "building the research template", "u-jamie", 6],
    ["Test on ten recent supplier requests", "testing on recent supplier requests", "u-sarah", 12],
    ["Add checks for missing certificates", "adding certificate checks", "u-jamie", 18],
    ["Write the one-page guide for buyers", "writing the buyer guide", "u-louie", 26],
    ["Prepare for launch", "preparing for launch", "u-sarah", 34],
  ];
  await db.planStep.createMany({ data: steps.map(([title, activePhrase, assigneeId, d], order) => ({ projectId: P, title, activePhrase, assigneeId, dueDate: days(d), order, generatedFromBrief: true })) });
  await db.project.update({ where: { id: P }, data: { stage: "BUILDING", planStatus: "READY", lastActivityAt: today, nextCheckInAt: days(7) } });
}

await clip("07-plan-moves-forward", "Louie Morris", async (h) => {
  await h.page.goto(`/ideas/${P}?tab=plan`);
  await h.ready();
  await h.wait(1100);
  await h.to(h.page.getByText(/^Louie is listing/).first(), 700).catch(() => {});
  await h.wait(500);
  await h.click(h.page.getByRole("checkbox", { name: "List the supplier sources Procurement trusts" }), 900);
  await h.wait(1300);
  await h.to(h.page.locator("main").getByText(/^Jamie is /).first(), 700).catch(() => {});
  await h.wait(1800);
});

await clip("08-blocked", "Louie Morris", async (h) => {
  await h.page.goto(`/ideas/${P}?tab=checkins`);
  await h.ready();
  await h.wait(900);
  const group = h.page.getByRole("radiogroup", { name: "Status" });
  await h.to(group.getByText("On track", { exact: true }), 600);
  await h.wait(250);
  await h.click(group.getByText("Blocked", { exact: true }), 700);
  await h.wait(400);
  await h.type(h.page.getByLabel("Note"), "We need the approved supplier list exported from SAP. Who can get it for us?", 26);
  await h.wait(400);
  await h.click(h.page.getByRole("button", { name: "Check in" }));
  await h.page.getByText("Checked in. Thanks.").waitFor();
  await h.wait(1600);
});

await clip("09-pulse-catches-it", "Alex Morgan", async (h) => {
  await h.page.goto("/pulse");
  await h.ready();
  await h.wait(1300);
  await h.to(h.page.getByText("Supplier Research Assistant").first(), 900);
  await h.wait(1000);
  await h.click(h.page.getByRole("link", { name: "Open" }).first(), 700);
  await h.page.waitForURL(new RegExp(`/ideas/${P}`)).catch(() => {});
  await h.ready();
  await h.wait(2200);
});

await clip("10-unblocked", "Louie Morris", async (h) => {
  await h.page.goto(`/ideas/${P}?tab=checkins`);
  await h.ready();
  await h.wait(1200);
  const group = h.page.getByRole("radiogroup", { name: "Status" });
  await h.click(group.getByText("On track", { exact: true }), 800);
  await h.wait(300);
  await h.type(h.page.getByLabel("Note"), "Alex got us the SAP export. Back on track.", 28);
  await h.wait(400);
  await h.click(h.page.getByRole("button", { name: "Check in" }));
  await h.page.getByText("Checked in. Thanks.").waitFor();
  await h.wait(2000);
});

// The rest of the build gets done and Spine hands it to a publishing specialist.
{
  await db.planStep.updateMany({ where: { projectId: P }, data: { done: true, doneAt: today } });
  await db.project.update({ where: { id: P }, data: { stage: "PUBLISHING", buildCompletedAt: today, publisherId: "u-alex", publishingAssignedAt: today, blockedAt: null, blockerNote: null, nextCheckInAt: null, lastActivityAt: today } });
}

await clip("11-goes-live", "Alex Morgan", async (h) => {
  await h.page.goto(`/ideas/${P}`);
  await h.ready();
  await h.wait(1200);
  await h.click(h.page.getByRole("button", { name: "Mark Live" }), 900);
  await h.wait(2600);
});

await clip("12-team-reports-hours", "Louie Morris", async (h) => {
  await h.page.goto(`/ideas/${P}?tab=outcomes`);
  await h.ready();
  await h.wait(1000);
  await h.type(h.page.locator("#evidence"), "Six buyers used it on 18 supplier requests; each one took 15 minutes instead of 55 (timed in October).", 20);
  await h.wait(300);
  await h.type(h.page.locator("#hours"), "12", 120);
  await h.wait(400);
  await h.click(h.page.getByRole("button", { name: "Report" }));
  await h.wait(2200);
});

await clip("13-verified-outside-the-team", "Alex Morgan", async (h) => {
  await h.page.goto(`/ideas/${P}?tab=outcomes`);
  await h.ready();
  await h.wait(1200);
  await h.to(h.page.getByText(/Six buyers used it/).first(), 900);
  await h.wait(900);
  await h.click(h.page.getByRole("button", { name: "Verify" }), 800);
  await h.wait(2400);
});

await clip("14-leadership-sees-it", "Alex Morgan", async (h) => {
  await h.page.goto("/leadership");
  await h.ready();
  await h.wait(1200);
  await h.to(h.page.getByText("Verified hours saved").first(), 800);
  await h.wait(500);
  const chart = h.page.locator("svg").filter({ has: h.page.locator("circle") }).first();
  const b = await chart.boundingBox().catch(() => null);
  if (b) {
    await h.glide(b.x + b.width * 0.08, b.y + b.height * 0.75, 700);
    await h.glide(b.x + b.width * 0.92, b.y + b.height * 0.25, 1800);
  }
  await h.wait(600);
  await h.to(h.page.getByText("Supplier Research Assistant").first(), 900).catch(() => {});
  await h.wait(1800);
});

await clip("15-playbook", "Ben Carter", async (h) => {
  await h.page.goto("/playbook");
  await h.ready();
  await h.wait(1000);
  await h.to(h.page.getByText("Claude (company workspace)").first(), 800);
  await h.wait(500);
  await h.to(h.page.getByText("Microsoft 365 Copilot").first(), 700);
  await h.wait(1500);
});

await browser.close();
await db.$disconnect();
