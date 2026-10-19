import { PrismaClient } from "@prisma/client";
import { DEMO_PASSWORD, seed } from "./build";

const db = new PrismaClient();
seed(db, { allClear: false })
  .then(() => console.log(`Seeded the demo organisation. Sign in as alex.morgan@demo.spine.test with "${DEMO_PASSWORD}".`))
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
