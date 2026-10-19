import "server-only";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import type { Organization, User } from "@prisma/client";
import { rootDb } from "../db";
import { hashToken, newToken } from "./crypto";

// Cookie sessions. The browser holds a random token; the database holds only its hash, so a
// database leak can't be replayed as a login. Sessions slide: each day of use extends them.

export const SESSION_COOKIE = "spine_session";
const MAX_AGE_MS = 30 * 86_400_000;
const TOUCH_EVERY_MS = 3_600_000;

const secure = () => process.env.NODE_ENV === "production" && process.env.SPINE_INSECURE_COOKIES !== "1";

export async function createSession(userId: string) {
  const token = newToken();
  const t = new Date();
  const ua = (await headers()).get("user-agent")?.slice(0, 200) ?? null;
  await rootDb.session.create({ data: { tokenHash: hashToken(token), userId, expiresAt: new Date(t.getTime() + MAX_AGE_MS), lastSeenAt: t, userAgent: ua } });
  await rootDb.user.update({ where: { id: userId }, data: { lastLoginAt: t } });
  (await cookies()).set(SESSION_COOKIE, token, { httpOnly: true, sameSite: "lax", secure: secure(), path: "/", maxAge: MAX_AGE_MS / 1000 });
}

export type SessionUser = { user: User; org: Organization; sessionId: string };

/** The signed-in person, or null. Deactivated people and expired sessions are signed out. */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token || token.length > 200) return null;
  const session = await rootDb.session.findUnique({ where: { tokenHash: hashToken(token) }, include: { user: { include: { org: true } } } });
  const t = new Date();
  if (!session || session.expiresAt <= t || session.user.status !== "ACTIVE") return null;
  if (t.getTime() - session.lastSeenAt.getTime() > TOUCH_EVERY_MS) {
    await rootDb.session.update({ where: { id: session.id }, data: { lastSeenAt: t, expiresAt: new Date(t.getTime() + MAX_AGE_MS) } }).catch(() => undefined);
  }
  const { org, ...user } = session.user;
  return { user, org, sessionId: session.id };
});

export async function destroyCurrentSession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await rootDb.session.deleteMany({ where: { tokenHash: hashToken(token) } });
  jar.delete(SESSION_COOKIE);
}

/** Signs a person out everywhere (deactivation, password change, access reset). */
export async function destroyAllSessions(userId: string, exceptSessionId?: string) {
  await rootDb.session.deleteMany({ where: { userId, ...(exceptSessionId ? { id: { not: exceptSessionId } } : {}) } });
}
