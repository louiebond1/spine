// Railway cron (every 15 minutes): auto-approvals, then the daily Pulse digest when it is due.
// npm run job:daily            normal run
// npm run job:daily -- --force send the digest now, ignoring the schedule
import { runDueAutoApprovals } from "../src/server/projects/autoApprove";
import { runDigest } from "../src/server/digest/digest";
import { scanOpportunities } from "../src/server/ai/opportunities";
import { db } from "../src/server/db";

async function main() {
  const approved = await runDueAutoApprovals();
  console.log(`[job] auto-approved ${approved} idea(s)`);
  try {
    console.log(`[job] spotted ${await scanOpportunities()} new opportunit(ies)`);
  } catch (error) {
    console.error("[job] opportunity scan failed", error);
  }
  const digest = await runDigest({ force: process.argv.includes("--force") });
  console.log(`[job] digest: ${digest}`);
}

main()
  .catch((error) => {
    console.error("[job] failed", error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
