import "server-only";
import type { Ctx } from "./ctx";

/** Records an administrative change. Never holds secrets or message content. */
export async function audit(ctx: Pick<Ctx, "db" | "user">, action: string, targetType: string, targetId: string | null, detail?: string) {
  await ctx.db.auditLog.create({ data: { orgId: ctx.user.orgId, actorId: ctx.user.id, action, targetType, targetId, detail: detail?.slice(0, 500) ?? null } });
}
