import "server-only";
import { cache } from "react";
import { db } from "./db";

export const getSettings = cache(async () => {
  return db.settings.upsert({ where: { id: "singleton" }, update: {}, create: { id: "singleton" } });
});
