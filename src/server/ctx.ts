import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import type { Organization, User } from "@prisma/client";
import { getSessionUser } from "./auth/session";
import { forOrg, type OrgDb } from "./tenant";

/**
 * The request context every feature works from: who is signed in, their organisation, and a
 * database client that can only see that organisation. Nobody is ever signed in by default.
 */
export type Ctx = { user: User; org: Organization; db: OrgDb; sessionId: string };

export const getCtx = cache(async (): Promise<Ctx | null> => {
  const s = await getSessionUser();
  if (!s) return null;
  return { user: s.user, org: s.org, db: forOrg(s.org.id), sessionId: s.sessionId };
});

/** For pages and server actions: sends signed-out visitors to sign in. */
export async function requireCtx(): Promise<Ctx> {
  const ctx = await getCtx();
  if (!ctx) redirect("/login");
  return ctx;
}

/** A context for scheduled work in one organisation (no person signed in). */
export function systemCtx(org: Organization): Omit<Ctx, "user" | "sessionId"> {
  return { org, db: forOrg(org.id) };
}

/** What domain code needs: the organisation and its scoped client (people optional). */
export type Scope = { db: OrgDb; org: Organization };
