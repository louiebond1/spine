import "server-only";
import type { Scope } from "./ctx";

/** This organisation's settings row (created with the organisation). */
export async function getSettings(scope: Pick<Scope, "db" | "org">) {
  return scope.db.settings.upsert({ where: { orgId: scope.org.id }, update: {}, create: { orgId: scope.org.id } });
}
