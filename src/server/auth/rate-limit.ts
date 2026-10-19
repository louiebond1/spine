import "server-only";
import { rootDb } from "../db";

/**
 * Fixed-window limiter backed by Postgres, so it holds across restarts and replicas.
 * Returns false once `limit` attempts have been made inside the window.
 */
export async function allow(key: string, limit: number, windowMs: number): Promise<boolean> {
  const t = new Date();
  const row = await rootDb.$transaction(async (tx) => {
    const existing = await tx.rateLimit.findUnique({ where: { key } });
    if (!existing || t.getTime() - existing.windowStart.getTime() > windowMs) {
      return tx.rateLimit.upsert({ where: { key }, create: { key, count: 1, windowStart: t }, update: { count: 1, windowStart: t } });
    }
    return tx.rateLimit.update({ where: { key }, data: { count: { increment: 1 } } });
  });
  return row.count <= limit;
}

export async function clearLimit(key: string) {
  await rootDb.rateLimit.deleteMany({ where: { key } });
}
