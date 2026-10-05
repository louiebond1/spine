import { PrismaClient } from "@prisma/client";
import { seed } from "./build";

const db = new PrismaClient();
seed(db, { allClear: true })
  .then(() => console.log("Seeded the all clear scenario."))
  .finally(() => db.$disconnect());
