import { PrismaClient } from "@prisma/client";
import { seed } from "./build";

const db = new PrismaClient();
seed(db, { allClear: true })
  .then(() => console.log("Seeded the all clear scenario."))
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
