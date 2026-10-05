import "server-only";
import type { Project, Question, User } from "@prisma/client";

// One predicate per row of the roles table in CLAUDE.md section 5.
// Server actions call assert(); the UI calls the same predicates to decide what to render.

export class ForbiddenError extends Error {
  constructor(message = "You can't do that.") {
    super(message);
    this.name = "ForbiddenError";
  }
}

export function assert(allowed: boolean, message?: string): asserts allowed {
  if (!allowed) throw new ForbiddenError(message);
}

type QuestionLike = Pick<Question, "askerId" | "claimerId" | "status">;
type ProjectLike = Pick<Project, "ownerId" | "stage" | "publisherId">;

export const can = {
  askQuestion: (_user: User) => true,

  claimQuestion: (user: User, q: QuestionLike) =>
    user.isChampion && q.status === "UNCLAIMED" && q.askerId !== user.id,

  postInThread: (user: User, q: QuestionLike) =>
    q.status !== "RESOLVED" && (q.askerId === user.id || (q.claimerId !== null && q.claimerId === user.id)),

  resolveQuestion: (user: User, q: QuestionLike) =>
    q.status === "IN_PROGRESS" && (q.askerId === user.id || q.claimerId === user.id),

  readThread: (user: User, q: QuestionLike) =>
    q.status !== "IN_PROGRESS" || q.askerId === user.id || q.claimerId === user.id,

  proposeIdea: (_user: User) => true,

  editIdea: (user: User, p: ProjectLike) => p.ownerId === user.id && p.stage === "IDEA",

  seeScores: (user: User, p: Pick<Project, "ownerId">) => p.ownerId === user.id,

  joinProject: (user: User, p: ProjectLike, team: { userId: string }[], teamSize: number) =>
    p.stage === "RECRUITING" && team.length < teamSize && !team.some((m) => m.userId === user.id),

  editPlan: (user: User, team: { userId: string }[]) => team.some((m) => m.userId === user.id),

  publish: (user: User, p: ProjectLike) =>
    user.isPublishingSpecialist && p.stage === "PUBLISHING" && p.publisherId === user.id,

  approve: (user: User, p: ProjectLike) => user.isAdmin && p.stage === "APPROVAL" && p.ownerId !== user.id,

  manage: (user: User) => user.isAdmin,
};
