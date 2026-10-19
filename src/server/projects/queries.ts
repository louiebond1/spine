import "server-only";
import type { Prisma, User } from "@prisma/client";
import { startOfMonth } from "@/lib/tz";
import { now } from "../clock";
import type { Ctx } from "../ctx";
import { forecast } from "./forecast";
import { nextAction, type NextAction } from "./nextAction";

/** Everything a list, card or row needs to describe a project. */
export const projectSummaryInclude = {
  owner: true,
  topic: true,
  publisher: true,
  team: { select: { userId: true } },
  steps: { select: { done: true, order: true, activePhrase: true, assignee: { select: { name: true } } } },
  impact: true,
} satisfies Prisma.ProjectInclude;

export type ProjectSummaryRow = Prisma.ProjectGetPayload<{ include: typeof projectSummaryInclude }>;

export type ProjectSummary = ProjectSummaryRow & {
  next: NextAction;
  hoursThisMonth: number;
  stepsDone: number;
};

export function hoursThisMonth(impact: { month: Date; hoursSaved: number }[]): number {
  const month = startOfMonth(now()).getTime();
  return impact.filter((i) => i.month.getTime() === month).reduce((sum, i) => sum + i.hoursSaved, 0);
}

export function summarise(p: ProjectSummaryRow, viewer: Pick<User, "id">): ProjectSummary {
  const hours = hoursThisMonth(p.impact);
  return {
    ...p,
    hoursThisMonth: hours,
    stepsDone: p.steps.filter((s) => s.done).length,
    next: nextAction({ ...p, teamCount: p.team.length, hoursThisMonth: hours }, viewer.id),
  };
}

/** Projects the viewer owns, is on the team of, approved or publishes. */
export function involvesUser(userId: string): Prisma.ProjectWhereInput {
  return {
    OR: [{ ownerId: userId }, { team: { some: { userId } } }, { approvedById: userId }, { publisherId: userId }],
  };
}

/**
 * Home "Your work": the three most recently active projects past Approval that involve the
 * viewer, leaving out anything already in the needs-you list. CLAUDE.md section 7, Home.
 */
export async function getYourWork(ctx: Ctx, excludeIds: string[]): Promise<ProjectSummary[]> {
  const viewer = ctx.user;
  const rows = await ctx.db.project.findMany({
    where: {
      AND: [involvesUser(viewer.id), { stage: { in: ["RECRUITING", "BUILDING", "PUBLISHING", "LIVE"] } }, { id: { notIn: excludeIds } }],
    },
    include: projectSummaryInclude,
    orderBy: { lastActivityAt: "desc" },
    take: 3,
  });
  return rows.map((p) => summarise(p, viewer));
}

export type ProjectFilter = { personId?: string };

/** Ideas & Projects: every submitted project, plus the viewer's own drafts. */
export async function listProjects(ctx: Ctx, filter: ProjectFilter): Promise<ProjectSummary[]> {
  const viewer = ctx.user;
  const rows = await ctx.db.project.findMany({
    where: {
      AND: [
        { OR: [{ stage: { not: "IDEA" } }, { ownerId: viewer.id }] },
        ...(filter.personId ? [involvesUser(filter.personId)] : []),
      ],
    },
    include: projectSummaryInclude,
    orderBy: { lastActivityAt: "desc" },
  });
  return rows.map((p) => summarise(p, viewer));
}

export async function getWorkspace(ctx: Ctx, id: string) {
  const viewer = ctx.user;
  const p = await ctx.db.project.findUnique({
    where: { id },
    include: {
      ...projectSummaryInclude,
      approvedBy: true,
      team: { include: { user: true }, orderBy: { joinedAt: "asc" } },
      steps: { include: { assignee: true }, orderBy: { order: "asc" } },
      messages: { include: { author: true }, orderBy: [{ sentAt: "asc" }, { createdAt: "asc" }] },
      events: { include: { actor: true }, orderBy: [{ at: "desc" }, { createdAt: "desc" }] },
      draftSteps: { orderBy: { order: "asc" }, select: { id: true, title: true } },
      checkIns: { include: { author: true }, orderBy: { at: "desc" }, take: 20 },
      impact: { orderBy: { month: "desc" } },
    },
  });
  // Drafts are private to their owner and the people they invited.
  if (!p) return null;
  if (p.stage === "IDEA" && p.ownerId !== viewer.id) {
    const invited = await ctx.db.projectInvite.findFirst({ where: { projectId: id, userId: viewer.id, status: { not: "DECLINED" } } });
    if (!invited) return null;
  }
  const reporters = await ctx.db.user.findMany({ where: { id: { in: p.impact.flatMap((i) => [i.reportedById, i.verifiedById]).filter((x): x is string => !!x) } }, select: { id: true, name: true } });
  return { ...p, summary: summarise(p, viewer), forecast: forecast({ ...p, steps: p.steps, events: p.events }), people: new Map(reporters.map((r) => [r.id, r.name])) };
}

export type Workspace = NonNullable<Awaited<ReturnType<typeof getWorkspace>>>;
