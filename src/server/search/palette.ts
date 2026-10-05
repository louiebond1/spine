import "server-only";
import type { User } from "@prisma/client";
import type { PaletteResults } from "@/components/ui/CommandPalette";
import { db } from "../db";

const LIMIT = 5;

export async function searchPalette(query: string, viewer: User): Promise<PaletteResults> {
  const q = query.trim();
  if (!q) return { questions: [], projects: [], people: [] };
  const contains = { contains: q, mode: "insensitive" as const };

  const [questions, projects, people] = await Promise.all([
    db.question.findMany({ where: { title: contains }, orderBy: { postedAt: "desc" }, take: LIMIT, select: { id: true, title: true } }),
    db.project.findMany({
      // Drafts are private to their owner.
      where: { title: contains, OR: [{ stage: { not: "IDEA" } }, { ownerId: viewer.id }] },
      orderBy: { lastActivityAt: "desc" },
      take: LIMIT,
      select: { id: true, title: true },
    }),
    db.user.findMany({ where: { name: contains }, orderBy: { name: "asc" }, take: LIMIT, select: { id: true, name: true } }),
  ]);

  return {
    questions: questions.map((x) => ({ id: x.id, label: x.title, href: `/help-desk/${x.id}` })),
    projects: projects.map((x) => ({ id: x.id, label: x.title, href: `/ideas/${x.id}` })),
    // There is no profile page, so people open Ideas & Projects filtered to them.
    people: people.map((x) => ({ id: x.id, label: x.name, href: `/ideas?view=list&person=${x.id}` })),
  };
}
