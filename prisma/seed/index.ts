import { PrismaClient } from "@prisma/client";
import { seed } from "./build";

const db = new PrismaClient();
seed(db, { allClear: false })
  .then(() => console.log("Seeded the default scenario."))
  .finally(() => db.$disconnect());
