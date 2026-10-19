import "server-only";
import type { User } from "@prisma/client";
import type { OrgDb, Tx } from "../tenant";

/**
 * The publishing specialist (in this organisation, still active) with the fewest initiatives
 * currently Launching. Ties go to whoever was assigned least recently, then by name.
 */
export async function assignPublisher(tx: Tx): Promise<User | null> {
  const specialists = await tx.user.findMany({
    where: { isPublishingSpecialist: true, status: "ACTIVE" },
    include: { projectsPublishing: { select: { stage: true, publishingAssignedAt: true } } },
  });
  if (specialists.length === 0) return null;
  const ranked = specialists
    .map((u) => ({
      user: u,
      load: u.projectsPublishing.filter((p) => p.stage === "PUBLISHING").length,
      lastAssigned: Math.max(0, ...u.projectsPublishing.map((p) => p.publishingAssignedAt?.getTime() ?? 0)),
    }))
    .sort((a, b) => a.load - b.load || a.lastAssigned - b.lastAssigned || a.user.name.localeCompare(b.user.name));
  const { projectsPublishing: _p, ...user } = ranked[0]!.user;
  return user;
}

/** Current Launching load per specialist (Admin > People). */
export async function publishingLoads(db: OrgDb) {
  const specialists = await db.user.findMany({
    where: { isPublishingSpecialist: true, status: "ACTIVE" },
    orderBy: { name: "asc" },
    include: { projectsPublishing: { where: { stage: "PUBLISHING" }, select: { id: true, title: true } } },
  });
  return specialists.map((u) => ({ id: u.id, name: u.name, initials: u.initials, projects: u.projectsPublishing }));
}
