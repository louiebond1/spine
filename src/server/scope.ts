import type { Organization } from "@prisma/client";
import { forOrg, type OrgDb } from "./tenant";

// Kept free of Next.js imports so scheduled jobs (scripts/daily-job.ts) can load it outside a request.

/** What domain code needs: the organisation and its scoped client (people optional). */
export type Scope = { db: OrgDb; org: Organization };

/** A context for scheduled work in one organisation (no person signed in). */
export function systemCtx(org: Organization): Scope {
  return { org, db: forOrg(org.id) };
}
