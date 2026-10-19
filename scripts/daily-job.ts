// Railway cron (every 15 minutes), run once per organisation:
// auto-approvals, approval chasing, check-in reminders, the opportunity scan (daily),
// last month's leadership report (early in the month) and the Pulse digest when it's due.
// npm run job:daily            normal run
// npm run job:daily -- --force send the digest now, ignoring the schedule
import { rootDb } from "../src/server/db";
import { systemCtx } from "../src/server/ctx";
import { runDueAutoApprovals } from "../src/server/projects/autoApprove";
import { remindDueCheckIns } from "../src/server/projects/checkinReminders";
import { chaseApprovals } from "../src/server/approvals/escalate";
import { publishLastMonthsReport } from "../src/server/report/report";
import { runDigest } from "../src/server/digest/digest";
import { scanOpportunities } from "../src/server/ai/opportunities";
import { getSettings } from "../src/server/settings";
import { now } from "../src/server/clock";

const DAY = 86_400_000;

async function step<T>(label: string, fn: () => Promise<T>) {
  try {
    const r = await fn();
    console.log(`[job] ${label}: ${typeof r === "object" ? JSON.stringify(r) : r}`);
  } catch (error) {
    // One failing step (for example AI being unavailable) never stops the others.
    console.error(`[job] ${label} failed:`, error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}

async function main() {
  const orgs = await rootDb.organization.findMany({ orderBy: { createdAt: "asc" } });
  for (const org of orgs) {
    const scope = systemCtx(org);
    console.log(`[job] organisation ${org.slug}`);
    await step("auto-approved", () => runDueAutoApprovals(scope));
    await step("approvals chased", () => chaseApprovals(scope));
    await step("check-in reminders", () => remindDueCheckIns(scope));
    await step("opportunity scan", async () => {
      const s = await getSettings(scope);
      if (s.opportunitiesScannedAt && now().getTime() - s.opportunitiesScannedAt.getTime() < DAY) return "not due";
      return scanOpportunities(scope);
    });
    await step("leadership report", () => publishLastMonthsReport(scope));
    await step("digest", () => runDigest(scope, { force: process.argv.includes("--force") }));
  }
}

main()
  .catch((error) => {
    console.error("[job] failed", error);
    process.exitCode = 1;
  })
  .finally(() => rootDb.$disconnect());
