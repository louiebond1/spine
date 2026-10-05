import "server-only";
import type { Prisma, User } from "@prisma/client";

/**
 * CLAUDE.md section 7, Ideas & Projects rule 11: the publishing specialist with the fewest
 * projects currently in Publishing. Ties go to whoever was assigned least recently (never
 * assigned counts as least recent), then by name so the choice is deterministic.
 */
export async function assignPublisher(tx: Prisma.TransactionClient): Promise<User | null> {
  const specialists = await tx.user.findMany({
    where: { isPublishingSpecialist: true },
    include: {
      projectsPublishing: { select: { stage: true, publishingAssignedAt: true } },
    },
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

/** Current Publishing load per specialist (Admin > Publishing specialists). */
export async function publishingLoads(tx: Prisma.TransactionClient) {
  const specialists = await tx.user.findMany({
    where: { isPublishingSpecialist: true },
    orderBy: { name: "asc" },
    include: { projectsPublishing: { where: { stage: "PUBLISHING" }, select: { id: true, title: true } } },
  });
  return specialists.map((u) => ({ id: u.id, name: u.name, initials: u.initials, projects: u.projectsPublishing }));
}
