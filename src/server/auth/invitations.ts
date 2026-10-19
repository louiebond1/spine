import "server-only";
import type { Invitation } from "@prisma/client";
import { rootDb } from "../db";
import { hashToken, newToken } from "./crypto";

export const INVITE_TTL_MS = 7 * 86_400_000;

export const appUrl = () => (process.env.SPINE_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");

/** Creates a single-use link. Returns the plain token once; only its hash is stored. */
export async function issueInvitation(input: {
  orgId: string;
  email: string;
  name: string;
  isChampion?: boolean;
  isAdmin?: boolean;
  isPublishingSpecialist?: boolean;
  invitedById: string | null;
  userId?: string | null;
}): Promise<{ invitation: Invitation; link: string }> {
  const token = newToken();
  const email = input.email.trim().toLowerCase();
  // Only one live link per address: older ones stop working.
  await rootDb.invitation.updateMany({ where: { orgId: input.orgId, email, acceptedAt: null, revokedAt: null }, data: { revokedAt: new Date() } });
  const invitation = await rootDb.invitation.create({
    data: {
      orgId: input.orgId,
      email,
      name: input.name.trim(),
      isChampion: !!input.isChampion,
      isAdmin: !!input.isAdmin,
      isPublishingSpecialist: !!input.isPublishingSpecialist,
      tokenHash: hashToken(token),
      invitedById: input.invitedById,
      userId: input.userId ?? null,
      expiresAt: new Date(Date.now() + INVITE_TTL_MS),
    },
  });
  return { invitation, link: `${appUrl()}/invite/${token}` };
}

/** A usable invitation for this token, or null when it's unknown, used, revoked or expired. */
export async function findOpenInvitation(token: string) {
  if (!token || token.length > 200) return null;
  const inv = await rootDb.invitation.findUnique({ where: { tokenHash: hashToken(token) }, include: { org: true } });
  if (!inv || inv.acceptedAt || inv.revokedAt || inv.expiresAt <= new Date()) return null;
  return inv;
}
