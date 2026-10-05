// Adds the two example approval rules to an existing database if it has none.
// npx tsx scripts/seed-approval-rules.ts
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
if ((await db.approvalRule.count()) > 0) {
  console.log("Approval rules already exist; nothing to do.");
} else {
  const topics = await db.topic.findMany({ where: { name: { in: ["Legal", "Finance"] } }, select: { id: true } });
  const people = await db.user.findMany({ where: { name: { in: ["Alex Morgan", "Louie Morris"] } }, select: { id: true } });
  await db.approvalRule.createMany({
    data: [
      {
        name: "Leadership sign-off for Legal and Finance apps",
        position: 0,
        topicIds: topics.map((t) => t.id),
        buildPaths: ["APP"],
        approverIds: people.map((p) => p.id),
        requireAll: people.length > 1,
        autoApproveDays: null,
      },
      { name: "Fast track small Cowork-native builds", position: 1, active: false, buildPaths: ["COWORK_NATIVE"], difficulties: ["EASY"], maxTotalHours: 40, fastTrack: true },
    ],
  });
  console.log("Added 2 example approval rules.");
}
await db.$disconnect();
