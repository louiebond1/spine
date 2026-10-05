import { PrismaClient } from "@prisma/client";
import { seed } from "./build";

// Runs on deploy: loads the demo data only when the database has no people yet.
const db = new PrismaClient();
(async () => {
  if ((await db.user.count()) > 0) {
    console.log("Database already has data; not seeding.");
    return;
  }
  await seed(db, { allClear: false });
  console.log("Empty database: seeded the demo scenario.");
})().finally(() => db.$disconnect());
