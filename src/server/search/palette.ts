import "server-only";
import type { Prisma } from "@prisma/client";
import type { Ctx } from "../ctx";
import { can } from "../permissions";

export type PaletteItem = { id: string; label: string; href: string };
export type PaletteResults = { questions: PaletteItem[]; projects: PaletteItem[]; playbook: PaletteItem[]; people: PaletteItem[] };

const LIMIT = 5;

/** Search within the organisation, showing only what the viewer may open. */
export async function searchPalette(ctx: Ctx, query: string): Promise<PaletteResults> {
  const q = query.trim();
  if (!q) return { questions: [], projects: [], playbook: [], people: [] };
  const contains = { contains: q, mode: "insensitive" as const };
  const { db, user } = ctx;
  const visibleQuestions: Prisma.QuestionWhereInput[] = [{ askerId: user.id }, { claimerId: user.id }, { sharedAt: { not: null } }];
  if (can.seeQueue(user)) visibleQuestions.push({ status: "UNCLAIMED" });

  const [questions, projects, tools, guides, people] = await Promise.all([
    db.question.findMany({ where: { title: contains, OR: visibleQuestions }, orderBy: { postedAt: "desc" }, take: LIMIT, select: { id: true, title: true } }),
    db.project.findMany({ where: { title: contains, OR: [{ stage: { not: "IDEA" } }, { ownerId: user.id }] }, orderBy: { lastActivityAt: "desc" }, take: LIMIT, select: { id: true, title: true } }),
    db.tool.findMany({ where: { name: contains }, take: 3, select: { id: true, name: true } }),
    db.guide.findMany({ where: { title: contains }, take: 3, select: { id: true, title: true } }),
    db.user.findMany({ where: { name: contains, status: "ACTIVE" }, orderBy: { name: "asc" }, take: LIMIT, select: { id: true, name: true } }),
  ]);

  return {
    questions: questions.map((x) => ({ id: x.id, label: x.title, href: `/help-desk/${x.id}` })),
    projects: projects.map((x) => ({ id: x.id, label: x.title, href: `/ideas/${x.id}` })),
    playbook: [...tools.map((x) => ({ id: x.id, label: x.name, href: `/playbook#tool-${x.id}` })), ...guides.map((x) => ({ id: x.id, label: x.title, href: `/playbook#guide-${x.id}` }))],
    people: people.map((x) => ({ id: x.id, label: x.name, href: `/ideas?view=list&person=${x.id}` })),
  };
}
